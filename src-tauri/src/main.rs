// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nexus_akari_pro_lib::lcu_connector::{IpcEnvelope, LcuRcuCredentials};
use nexus_akari_pro_lib::AppKernelState;
use serde_json::Value;
use std::env;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

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
    let candidates = [
        (
            app_root.join("runtime").join("node.exe"),
            app_root.join("runtime").join("server.cjs"),
        ),
        (
            app_root.join("resources").join("runtime").join("node.exe"),
            app_root.join("resources").join("runtime").join("server.cjs"),
        ),
        (
            PathBuf::from("node"),
            app_root.join("runtime").join("server.cjs"),
        ),
        (
            PathBuf::from("node"),
            app_root.join("dist-server").join("server.cjs"),
        ),
    ];

    let mut selected: Option<(PathBuf, PathBuf)> = None;
    for (node_bin, script_path) in candidates {
        if script_path.exists() && (node_bin == Path::new("node") || node_bin.exists()) {
            selected = Some((node_bin, script_path));
            break;
        }
    }

    let (node_bin, server_script) = selected?;

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

fn terminate_sidecar_tree(child: &mut Child) {
    #[cfg(target_os = "windows")]
    {
        let pid = child.id();
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[tauri::command]
async fn probe_lcu_rcu_credentials_cmd(
    state: State<'_, Arc<AppKernelState>>,
) -> Result<Option<LcuRcuCredentials>, String> {
    state.probe_lcu_rcu_credentials().await
}

#[tauri::command]
async fn get_ipc_ring_buffer_cmd(
    state: State<'_, Arc<AppKernelState>>,
) -> Result<Vec<IpcEnvelope>, String> {
    state.get_ipc_ring_buffer().await
}

#[tauri::command]
async fn inject_lcu_rune_page_cmd(
    state: State<'_, Arc<AppKernelState>>,
    page_name: String,
    primary_style_id: i32,
    sub_style_id: i32,
    selected_perk_ids: Vec<i32>,
) -> Result<Value, String> {
    state
        .inject_lcu_rune_page(&page_name, primary_style_id, sub_style_id, selected_perk_ids)
        .await
}

#[tauri::command]
async fn execute_lcu_aram_bench_swap_cmd(
    state: State<'_, Arc<AppKernelState>>,
    target_champion_id: i32,
) -> Result<Value, String> {
    state.execute_lcu_aram_bench_swap(target_champion_id).await
}

#[tauri::command]
async fn execute_champ_select_tick_cmd(
    state: State<'_, Arc<AppKernelState>>,
) -> Result<Vec<String>, String> {
    state.execute_champ_select_tick().await
}

#[tauri::command]
async fn fetch_external_opgg_meta_cmd(
    state: State<'_, Arc<AppKernelState>>,
    mode: String,
) -> Result<Value, String> {
    let url = if mode.eq_ignore_ascii_case("aram") {
        "https://lol-api-champion.op.gg/api/KR/champions/aram?tier=all"
    } else {
        "https://lol-api-champion.op.gg/api/KR/champions/ranked?tier=emerald_plus"
    };
    let started = std::time::Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(7))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 NexusAkariPro/4.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let val: Value = resp.json().await.map_err(|e| e.to_string())?;
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;

    state
        .ring_buffer
        .push(IpcEnvelope {
            id: format!("ext-opgg-{}", chrono::Utc::now().timestamp_micros()),
            timestamp: chrono::Utc::now().format("%H:%M:%S%.3f").to_string(),
            channel: "SGP_HTTPS".to_string(),
            method: "GET".to_string(),
            endpoint: url.to_string(),
            status,
            duration_ms: (elapsed_ms * 10.0).round() / 10.0,
            payload_summary: format!("Native Rust OP.GG {} live meta synced", mode),
        })
        .await;

    Ok(val)
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let is_smoke_test = args.iter().any(|a| a == "--smoke-test");

    let state = Arc::new(nexus_akari_pro_lib::create_kernel_state());

    if is_smoke_test {
        let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
        rt.block_on(async {
            let _ = state.probe_lcu_rcu_credentials().await;
            let frames = state.get_ipc_ring_buffer().await.unwrap_or_default();
            println!(
                "NexusAkari Pro v4.0.0 Native Tauri 2 Kernel Smoke Test OK (IPC frames: {})",
                frames.len()
            );
        });
        return;
    }

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(32100);
    let app_root = resolve_app_root();
    let sidecar_holder: Arc<Mutex<Option<Child>>> =
        Arc::new(Mutex::new(spawn_local_bridge_sidecar(&app_root, port)));

    let state_for_setup = Arc::clone(&state);
    let sidecar_for_event = Arc::clone(&sidecar_holder);

    let tauri_result = tauri::Builder::default()
        .manage(Arc::clone(&state))
        .setup(move |_app| {
            let st = Arc::clone(&state_for_setup);
            tauri::async_runtime::spawn(async move {
                let _ = st.probe_lcu_rcu_credentials().await;
                let _watchdog = st.start_background_watchdog();
                let mut ticker = tokio::time::interval(Duration::from_millis(1500));
                loop {
                    ticker.tick().await;
                    if st.credentials.read().await.is_some() {
                        let _ = st.execute_champ_select_tick().await;
                    }
                }
            });
            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut guard) = sidecar_for_event.lock() {
                    if let Some(ref mut child) = *guard {
                        terminate_sidecar_tree(child);
                    }
                    *guard = None;
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            probe_lcu_rcu_credentials_cmd,
            get_ipc_ring_buffer_cmd,
            inject_lcu_rune_page_cmd,
            execute_lcu_aram_bench_swap_cmd,
            execute_champ_select_tick_cmd,
            fetch_external_opgg_meta_cmd,
        ])
        .run(tauri::generate_context!());

    if tauri_result.is_err() {
        // Fallback if WebView2 runtime is missing on an older Windows system: keep sidecar alive
        if let Ok(mut guard) = sidecar_holder.lock() {
            if let Some(ref mut child) = *guard {
                loop {
                    match child.try_wait() {
                        Ok(Some(_)) | Err(_) => break,
                        Ok(None) => std::thread::sleep(Duration::from_millis(1000)),
                    }
                }
            }
        }
    }
}
