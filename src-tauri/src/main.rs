// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn resolve_app_root() -> PathBuf {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.to_path_buf();
        }
    }
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn spawn_local_bridge_sidecar(app_root: &Path, port: u16) -> Option<Child> {
    let bundled_node = app_root.join("runtime").join("node.exe");
    let bundled_server = app_root.join("runtime").join("server.cjs");
    let fallback_server = app_root.join("dist-server").join("server.cjs");

    let (node_bin, server_script) = if bundled_node.exists() && bundled_server.exists() {
        (bundled_node, bundled_server)
    } else if bundled_server.exists() {
        (PathBuf::from("node"), bundled_server)
    } else if fallback_server.exists() {
        (PathBuf::from("node"), fallback_server)
    } else {
        return None;
    };

    let mut cmd = Command::new(node_bin);
    cmd.arg(server_script)
        .current_dir(app_root)
        .env("NODE_ENV", "production")
        .env("PORT", port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn().ok()
}

fn launch_desktop_window(url: &str) -> Option<Child> {
    #[cfg(target_os = "windows")]
    {
        let app_arg = format!("--app={}", url);
        let mut edge_cmd = Command::new("cmd");
        edge_cmd
            .args([
                "/C",
                "start",
                "",
                "msedge",
                &app_arg,
                "--window-size=1440,900",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW);

        if let Ok(child) = edge_cmd.spawn() {
            return Some(child);
        }

        let mut fallback_cmd = Command::new("cmd");
        fallback_cmd
            .args(["/C", "start", "", url])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW);
        fallback_cmd.spawn().ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = url;
        None
    }
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    let is_smoke_test = args.iter().any(|a| a == "--smoke-test");

    let state = Arc::new(nexus_akari_pro_lib::create_kernel_state());
    let _ = state.probe_lcu_rcu_credentials().await;
    let _watchdog_handle = state.start_background_watchdog();

    if is_smoke_test {
        let frames = state.get_ipc_ring_buffer().await.unwrap_or_default();
        println!(
            "NexusAkari Pro v4.0.0 Native Kernel Smoke Test OK (IPC frames: {})",
            frames.len()
        );
        return;
    }

    // Spawn native Rust ChampSelect & Lifecycle Automation loop (1500ms tick)
    let state_for_loop = Arc::clone(&state);
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_millis(1500));
        loop {
            ticker.tick().await;
            let has_creds = state_for_loop.credentials.read().await.is_some();
            if has_creds {
                let _ = state_for_loop.execute_champ_select_tick().await;
            }
        }
    });

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(32100);
    let app_root = resolve_app_root();
    let mut sidecar = spawn_local_bridge_sidecar(&app_root, port);

    let local_url = format!("http://127.0.0.1:{}", port);
    let health_url = format!("{}/api/bridge/bootstrap", local_url);

    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_millis(800))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    for _ in 0..30 {
        if let Ok(resp) = http_client.get(&health_url).send().await {
            if resp.status().is_success() {
                break;
            }
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }

    let _window_proc = launch_desktop_window(&local_url);

    // Keep native kernel & sidecar running until Ctrl+C or process termination
    let _ = tokio::signal::ctrl_c().await;

    if let Some(ref mut child) = sidecar {
        let _ = child.kill();
    }
}
