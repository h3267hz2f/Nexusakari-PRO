// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(clippy::all, warnings)]

use base64::engine::general_purpose::STANDARD as BASE64_STD;
use base64::Engine;
use nexus_akari_pro_lib::automation::AutomationConfig;
use nexus_akari_pro_lib::lcu_connector::{IpcEnvelope, LcuRcuCredentials, WampEventPayload};
use nexus_akari_pro_lib::AppKernelState;
use reqwest::Method;
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;
use tauri::State;

fn resolve_user_state_path() -> PathBuf {
    let base = env::var("APPDATA")
        .or_else(|_| env::var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| env::temp_dir());
    let dir = base.join("NexusAkariPro");
    let _ = fs::create_dir_all(&dir);
    dir.join("nexus-akari-user-state.json")
}

#[tauri::command]
async fn probe_lcu_rcu_credentials_cmd(
    state: State<'_, Arc<AppKernelState>>,
) -> Result<Option<LcuRcuCredentials>, String> {
    state.probe_lcu_rcu_credentials().await
}

#[tauri::command]
async fn set_manual_credentials_cmd(
    state: State<'_, Arc<AppKernelState>>,
    credentials: LcuRcuCredentials,
) -> Result<LcuRcuCredentials, String> {
    {
        let mut guard = state.credentials.write().await;
        *guard = Some(credentials.clone());
    }
    Ok(credentials)
}

#[tauri::command]
async fn set_active_region_cmd(
    state: State<'_, Arc<AppKernelState>>,
    region_code: String,
) -> Result<String, String> {
    {
        let mut guard = state.active_region.write().await;
        *guard = region_code.clone();
    }
    Ok(region_code)
}

#[tauri::command]
async fn update_automation_config_cmd(
    state: State<'_, Arc<AppKernelState>>,
    config: AutomationConfig,
) -> Result<AutomationConfig, String> {
    {
        let mut guard = state.automation_config.write().await;
        *guard = config.clone();
    }
    Ok(config)
}

#[tauri::command]
async fn batch_scout_sgp_cmd(
    state: State<'_, Arc<AppKernelState>>,
    puuids: Vec<String>,
) -> Result<Value, String> {
    let pairs = state.batch_scout_sgp_players(puuids).await?;
    let mut map = serde_json::Map::new();
    for (puuid, res) in pairs {
        if let Ok(val) = res {
            map.insert(puuid, val);
        }
    }
    Ok(Value::Object(map))
}

#[tauri::command]
async fn get_ipc_ring_buffer_cmd(
    state: State<'_, Arc<AppKernelState>>,
) -> Result<Vec<IpcEnvelope>, String> {
    state.get_ipc_ring_buffer().await
}

#[tauri::command]
async fn lcu_raw_request_cmd(
    state: State<'_, Arc<AppKernelState>>,
    method: String,
    endpoint: String,
    body: Option<Value>,
) -> Result<Value, String> {
    let creds = state
        .credentials
        .read()
        .await
        .clone()
        .ok_or_else(|| "LCU not connected".to_string())?;
    let http_method =
        Method::from_bytes(method.to_uppercase().as_bytes()).unwrap_or(Method::GET);
    state
        .lcu_client
        .lcu_request(&creds, http_method, &endpoint, body, &state.ring_buffer)
        .await
}

#[tauri::command]
async fn rcu_raw_request_cmd(
    state: State<'_, Arc<AppKernelState>>,
    endpoint: String,
) -> Result<Value, String> {
    let creds = state
        .credentials
        .read()
        .await
        .clone()
        .ok_or_else(|| "RCU not connected".to_string())?;
    if creds.rcu_port == 0 || creds.rcu_auth_token.is_empty() {
        return Err("RCU port/token not available".to_string());
    }
    let url = format!("https://127.0.0.1:{}{}", creds.rcu_port, endpoint);
    let auth_header = format!(
        "Basic {}",
        BASE64_STD.encode(format!("riot:{}", creds.rcu_auth_token))
    );
    let started = std::time::Instant::now();
    let resp = state
        .lcu_client
        .inner_client()
        .get(&url)
        .header("Authorization", auth_header)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let text = resp.text().await.unwrap_or_default();
    let val: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({}));
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;

    state
        .ring_buffer
        .push(IpcEnvelope {
            id: format!("rcu-{}", chrono::Utc::now().timestamp_micros()),
            timestamp: chrono::Utc::now().format("%H:%M:%S%.3f").to_string(),
            channel: "RCU_AUTH".to_string(),
            method: "GET".to_string(),
            endpoint,
            status,
            duration_ms: (elapsed_ms * 10.0).round() / 10.0,
            payload_summary: format!("RCU HTTPS Response ({})", status),
        })
        .await;

    if (200..300).contains(&status) {
        Ok(val)
    } else {
        Err(format!("RCU HTTP {}", status))
    }
}

#[tauri::command]
async fn live_2999_request_cmd(
    state: State<'_, Arc<AppKernelState>>,
    endpoint: String,
) -> Result<Value, String> {
    let url = format!("https://127.0.0.1:2999{}", endpoint);
    let started = std::time::Instant::now();
    let resp = state
        .lcu_client
        .inner_client()
        .get(&url)
        .timeout(Duration::from_millis(1200))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let val: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;

    state
        .ring_buffer
        .push(IpcEnvelope {
            id: format!("live2999-{}", chrono::Utc::now().timestamp_micros()),
            timestamp: chrono::Utc::now().format("%H:%M:%S%.3f").to_string(),
            channel: "LIVE_2999".to_string(),
            method: "GET".to_string(),
            endpoint,
            status,
            duration_ms: (elapsed_ms * 10.0).round() / 10.0,
            payload_summary: "LiveClientData :2999 telemetry frame".to_string(),
        })
        .await;

    Ok(val)
}

#[tauri::command]
async fn external_http_get_cmd(
    state: State<'_, Arc<AppKernelState>>,
    url: String,
    bearer_token: Option<String>,
) -> Result<Value, String> {
    let started = std::time::Instant::now();
    let mut req = state
        .lcu_client
        .inner_client()
        .get(&url)
        .timeout(Duration::from_secs(7))
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NexusAkariPro/4.0",
        )
        .header("Accept", "application/json, text/javascript, */*");
    if let Some(ref token) = bearer_token {
        if !token.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", token));
        }
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let raw_text = resp.text().await.map_err(|e| e.to_string())?;
    let val: Value = serde_json::from_str(&raw_text).map_err(|e| e.to_string())?;
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;

    state
        .ring_buffer
        .push(IpcEnvelope {
            id: format!("ext-http-{}", chrono::Utc::now().timestamp_micros()),
            timestamp: chrono::Utc::now().format("%H:%M:%S%.3f").to_string(),
            channel: "SGP_HTTPS".to_string(),
            method: "GET".to_string(),
            endpoint: url.chars().take(80).collect(),
            status,
            duration_ms: (elapsed_ms * 10.0).round() / 10.0,
            payload_summary: format!("Native Rust External HTTP -> {}", status),
        })
        .await;

    if (200..300).contains(&status) {
        Ok(val)
    } else {
        Err(format!("External HTTP {}", status))
    }
}

#[tauri::command]
async fn load_user_state_cmd() -> Result<Option<Value>, String> {
    let path = resolve_user_state_path();
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let parsed: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(Some(parsed))
}

#[tauri::command]
async fn save_user_state_cmd(payload: Value) -> Result<bool, String> {
    let path = resolve_user_state_path();
    let serialized = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    fs::write(&path, serialized).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn launch_spectator_process_cmd(
    state: State<'_, Arc<AppKernelState>>,
    spectator_domain: String,
    spectator_port: u16,
    encryption_key: String,
    game_id: String,
    region_code: String,
) -> Result<Value, String> {
    let mut candidate_dirs: Vec<PathBuf> = vec![
        PathBuf::from(r"C:\Riot Games\League of Legends\Game"),
        PathBuf::from(r"D:\Riot Games\League of Legends\Game"),
        PathBuf::from(r"C:\WeGameApps\英雄联盟\Game"),
        PathBuf::from(r"D:\WeGameApps\英雄联盟\Game"),
        PathBuf::from(r"E:\WeGameApps\英雄联盟\Game"),
    ];

    if let Some(creds) = state.credentials.read().await.clone() {
        if !creds.install_directory.is_empty() {
            let p = PathBuf::from(&creds.install_directory);
            candidate_dirs.insert(0, p.join("Game"));
            candidate_dirs.insert(1, p);
        }
        if let Ok(val) = state
            .lcu_client
            .lcu_request(
                &creds,
                Method::GET,
                "/data-store/v1/install-dir",
                None,
                &state.ring_buffer,
            )
            .await
        {
            if let Some(dir_str) = val.as_str() {
                let p = PathBuf::from(dir_str);
                candidate_dirs.insert(0, p.join("Game"));
                candidate_dirs.insert(1, p);
            }
        }
    }

    let mut found_exe: Option<(PathBuf, PathBuf)> = None;
    for dir in candidate_dirs {
        let exe = dir.join("League of Legends.exe");
        if exe.exists() {
            found_exe = Some((exe, dir));
            break;
        }
    }

    let spec_arg = format!(
        "spectator {}:{} {} {} {}",
        spectator_domain, spectator_port, encryption_key, game_id, region_code
    );
    let default_exe_str = r"C:\Riot Games\League of Legends\Game\League of Legends.exe";
    let cli_command = format!(
        "\"{}\" \"{}\" \"-UseRads\" \"-GameBaseDir=..\"",
        found_exe
            .as_ref()
            .map(|(e, _)| e.to_string_lossy().to_string())
            .unwrap_or_else(|| default_exe_str.to_string()),
        spec_arg
    );

    if let Some((exe_path, game_dir)) = found_exe {
        let mut cmd = Command::new(&exe_path);
        cmd.current_dir(&game_dir)
            .args([&spec_arg, "-UseRads", "-GameBaseDir=.."])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        match cmd.spawn() {
            Ok(_) => Ok(json!({
                "launched": true,
                "executablePath": exe_path.to_string_lossy(),
                "cliCommand": cli_command,
                "message": format!("已直接启动本地 League of Legends.exe 进入 {} ({}) 实时 OB 观战！", region_code, game_id),
            })),
            Err(e) => Ok(json!({
                "launched": false,
                "executablePath": exe_path.to_string_lossy(),
                "cliCommand": cli_command,
                "message": format!("启动 League of Legends.exe 失败 ({})，请复制下方命令行手动运行。", e),
            })),
        }
    } else {
        Ok(json!({
            "launched": false,
            "executablePath": default_exe_str,
            "cliCommand": cli_command,
            "message": "当前环境未扫描到本机 League of Legends.exe 路径，已生成标准 OB 命令行参数。",
        }))
    }
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
    external_http_get_cmd(state, url.to_string(), None).await
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

    let state_for_setup = Arc::clone(&state);

    let _ = tauri::Builder::default()
        .manage(Arc::clone(&state))
        .setup(move |_app| {
            let st = Arc::clone(&state_for_setup);
            tauri::async_runtime::spawn(async move {
                let _ = st.probe_lcu_rcu_credentials().await;
                let _watchdog = st.start_background_watchdog();

                let (wamp_tx, mut wamp_rx) =
                    tokio::sync::broadcast::channel::<WampEventPayload>(128);
                let st_wamp_runner = Arc::clone(&st);

                // <5ms real-time WAMP v1.0 event-driven automation responder
                tauri::async_runtime::spawn(async move {
                    while let Ok(ev) = wamp_rx.recv().await {
                        match ev.uri.as_str() {
                            "/lol-champ-select/v1/session" => {
                                let _ = st_wamp_runner.execute_champ_select_tick().await;
                            }
                            "/lol-gameflow/v1/gameflow-phase" => {
                                if let Some(phase_str) = ev.data.as_str() {
                                    let _ =
                                        st_wamp_runner.run_lifecycle_automation(phase_str).await;
                                }
                            }
                            "/lol-matchmaking/v1/ready-check" => {
                                let _ = st_wamp_runner.run_lifecycle_automation("ReadyCheck").await;
                            }
                            _ => {}
                        }
                    }
                });

                let mut ticker = tokio::time::interval(Duration::from_millis(1500));
                let mut last_lifecycle_phase = String::new();
                let mut active_wamp_port: u16 = 0;
                let mut wamp_kill_tx: Option<tokio::sync::watch::Sender<bool>> = None;

                loop {
                    ticker.tick().await;
                    let creds_opt = st.credentials.read().await.clone();
                    if let Some(ref creds) = creds_opt {
                        if creds.lcu_port != active_wamp_port {
                            if let Some(old_tx) = wamp_kill_tx.take() {
                                let _ = old_tx.send(true);
                            }
                            let (kill_tx, kill_rx) = tokio::sync::watch::channel(false);
                            wamp_kill_tx = Some(kill_tx);
                            active_wamp_port = creds.lcu_port;
                            let _wamp_handle =
                                nexus_akari_pro_lib::lcu_connector::spawn_wamp_subscriber_loop(
                                    creds.clone(),
                                    Arc::clone(&st.ring_buffer),
                                    wamp_tx.clone(),
                                    kill_rx,
                                );
                        }

                        let phase_val = st
                            .lcu_client
                            .lcu_request(
                                creds,
                                Method::GET,
                                "/lol-gameflow/v1/gameflow-phase",
                                None,
                                &st.ring_buffer,
                            )
                            .await;
                        if let Ok(val) = phase_val {
                            let phase = val.as_str().unwrap_or("Lobby").to_string();
                            if phase == "ChampSelect" {
                                let _ = st.execute_champ_select_tick().await;
                            } else if phase != last_lifecycle_phase
                                && (phase == "ReadyCheck"
                                    || phase == "Reconnect"
                                    || phase == "EndOfGame")
                            {
                                let _ = st.run_lifecycle_automation(&phase).await;
                            }
                            last_lifecycle_phase = phase;
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            probe_lcu_rcu_credentials_cmd,
            set_manual_credentials_cmd,
            set_active_region_cmd,
            update_automation_config_cmd,
            batch_scout_sgp_cmd,
            get_ipc_ring_buffer_cmd,
            lcu_raw_request_cmd,
            rcu_raw_request_cmd,
            live_2999_request_cmd,
            external_http_get_cmd,
            load_user_state_cmd,
            save_user_state_cmd,
            launch_spectator_process_cmd,
            inject_lcu_rune_page_cmd,
            execute_lcu_aram_bench_swap_cmd,
            execute_champ_select_tick_cmd,
            fetch_external_opgg_meta_cmd,
        ])
        .run(tauri::generate_context!());
}
