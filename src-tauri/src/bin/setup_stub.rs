// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const SFX_MAGIC: &[u8; 8] = b"NAKP4SFX";

fn apply_no_window_flag(cmd: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}

fn resolve_install_dir() -> PathBuf {
    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        return PathBuf::from(local_app_data)
            .join("Programs")
            .join("NexusAkariPro");
    }
    env::temp_dir().join("NexusAkariPro")
}

fn extract_embedded_zip(exe_path: &Path, out_zip_path: &Path) -> Result<u64, String> {
    let mut file = File::open(exe_path).map_err(|e| format!("Failed to open installer: {}", e))?;
    let total_len = file
        .metadata()
        .map_err(|e| format!("Failed to read metadata: {}", e))?
        .len();

    if total_len < 16 {
        return Err("Installer binary is smaller than 16-byte SFX trailer".to_string());
    }

    file.seek(SeekFrom::End(-16))
        .map_err(|e| format!("Failed to seek trailer: {}", e))?;
    let mut trailer = [0u8; 16];
    file.read_exact(&mut trailer)
        .map_err(|e| format!("Failed to read trailer: {}", e))?;

    let magic = &trailer[8..16];
    if magic != SFX_MAGIC {
        return Err("No embedded NAKP4SFX archive found in installer".to_string());
    }

    let mut len_bytes = [0u8; 8];
    len_bytes.copy_from_slice(&trailer[0..8]);
    let zip_len = u64::from_le_bytes(len_bytes);

    if zip_len == 0 || zip_len + 16 > total_len {
        return Err("Invalid embedded archive length".to_string());
    }

    let zip_offset = total_len - 16 - zip_len;
    file.seek(SeekFrom::Start(zip_offset))
        .map_err(|e| format!("Failed to seek payload start: {}", e))?;

    let mut out_file =
        File::create(out_zip_path).map_err(|e| format!("Failed to create temp zip: {}", e))?;
    let mut reader = file.take(zip_len);
    std::io::copy(&mut reader, &mut out_file)
        .map_err(|e| format!("Failed to extract payload bytes: {}", e))?;
    out_file
        .flush()
        .map_err(|e| format!("Failed to flush temp zip: {}", e))?;

    Ok(zip_len)
}

fn unpack_zip_to_install_dir(zip_path: &Path, install_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(install_dir)
        .map_err(|e| format!("Failed to create install dir: {}", e))?;

    let zip_str = zip_path.to_string_lossy().to_string();
    let dest_str = install_dir.to_string_lossy().to_string();

    let mut tar_cmd = Command::new("tar");
    tar_cmd
        .args(["-xf", &zip_str, "-C", &dest_str])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    apply_no_window_flag(&mut tar_cmd);

    if let Ok(status) = tar_cmd.status() {
        if status.success() {
            return Ok(());
        }
    }

    let ps_script = format!(
        "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
        zip_str.replace('\'', "''"),
        dest_str.replace('\'', "''")
    );
    let mut ps_cmd = Command::new("powershell");
    ps_cmd
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    apply_no_window_flag(&mut ps_cmd);

    let status = ps_cmd
        .status()
        .map_err(|e| format!("Failed to unpack archive: {}", e))?;
    if status.success() {
        Ok(())
    } else {
        Err("Archive extraction returned non-zero status".to_string())
    }
}

fn create_windows_shortcuts(install_dir: &Path) {
    let target_exe = install_dir.join("nexus-akari-pro.exe");
    let target_str = target_exe.to_string_lossy().replace('\'', "''");
    let work_str = install_dir.to_string_lossy().replace('\'', "''");

    let ps_script = format!(
        "$ws = New-Object -ComObject WScript.Shell; \
         $desk = [Environment]::GetFolderPath('Desktop'); \
         $lnk = $ws.CreateShortcut((Join-Path $desk 'NexusAkari Pro.lnk')); \
         $lnk.TargetPath = '{}'; \
         $lnk.WorkingDirectory = '{}'; \
         $lnk.Save();",
        target_str, work_str
    );

    let mut ps_cmd = Command::new("powershell");
    ps_cmd
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    apply_no_window_flag(&mut ps_cmd);
    let _ = ps_cmd.status();
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|a| a == "--smoke-test") {
        println!("NexusAkari Pro v4.0.0 SFX Setup Stub Smoke Test OK");
        return;
    }

    let Ok(exe_path) = env::current_exe() else {
        return;
    };

    let temp_zip = env::temp_dir().join("nexus-akari-pro-v4-setup-payload.zip");
    let install_dir = resolve_install_dir();

    if extract_embedded_zip(&exe_path, &temp_zip).is_ok() {
        if unpack_zip_to_install_dir(&temp_zip, &install_dir).is_ok() {
            create_windows_shortcuts(&install_dir);
            let installed_exe = install_dir.join("nexus-akari-pro.exe");
            if installed_exe.exists() {
                let mut launch_cmd = Command::new(&installed_exe);
                launch_cmd
                    .current_dir(&install_dir)
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());
                apply_no_window_flag(&mut launch_cmd);
                let _ = launch_cmd.spawn();
            }
        }
        let _ = fs::remove_file(&temp_zip);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sfx_trailer_extraction_roundtrip() {
        let tmp_dir = env::temp_dir();
        let fake_sfx = tmp_dir.join("test_nexus_akari_sfx.bin");
        let extracted_zip = tmp_dir.join("test_nexus_akari_out.zip");

        let stub_bytes = b"FAKE_PE_HEADER_STUB_BYTES";
        let payload_bytes = b"PK\x03\x04FAKE_ZIP_ARCHIVE_CONTENT_1234567890";
        let len_bytes = (payload_bytes.len() as u64).to_le_bytes();

        {
            let mut f = File::create(&fake_sfx).unwrap();
            f.write_all(stub_bytes).unwrap();
            f.write_all(payload_bytes).unwrap();
            f.write_all(&len_bytes).unwrap();
            f.write_all(SFX_MAGIC).unwrap();
            f.flush().unwrap();
        }

        let extracted_len = extract_embedded_zip(&fake_sfx, &extracted_zip).unwrap();
        assert_eq!(extracted_len, payload_bytes.len() as u64);

        let read_back = fs::read(&extracted_zip).unwrap();
        assert_eq!(read_back, payload_bytes);

        let _ = fs::remove_file(&fake_sfx);
        let _ = fs::remove_file(&extracted_zip);
    }
}

