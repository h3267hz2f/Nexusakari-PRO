//! NexusAkari Pro (v4) — Tauri 2 Core Library & IPC Command Handlers

pub mod automation;
pub mod lcu_connector;
pub mod sgp_client;

use automation::{arbitrate_safe_ban, diff_aram_bench_pool, AutomationConfig, BanArbitrationDecision};
use lcu_connector::{scan_dual_process_credentials, IpcEnvelope, IpcRingBuffer, LcuRcuCredentials};
use sgp_client::{build_sgp_spectator_command, SgpSessionCache};
use std::sync::Arc;

pub struct AppKernelState {
    pub ring_buffer: Arc<IpcRingBuffer>,
    pub sgp_cache: Arc<SgpSessionCache>,
}

impl AppKernelState {
    pub async fn probe_lcu_rcu_credentials(&self) -> Result<Option<LcuRcuCredentials>, String> {
        let creds = scan_dual_process_credentials();
        self.ring_buffer
            .push(IpcEnvelope {
                id: format!("ipc-{}", chrono::Utc::now().timestamp_millis()),
                timestamp: chrono::Utc::now().format("%H:%M:%S%.3f").to_string(),
                channel: "TAURI_CMD".to_string(),
                method: "INVOKE".to_string(),
                endpoint: "probe_lcu_rcu_credentials".to_string(),
                status: if creds.is_some() { 200 } else { 404 },
                duration_ms: 1.2,
                payload_summary: "Scanned LeagueClientUx & RiotClientServices PEB command line"
                    .to_string(),
            })
            .await;
        Ok(creds)
    }

    pub async fn get_ipc_ring_buffer(&self) -> Result<Vec<IpcEnvelope>, String> {
        Ok(self.ring_buffer.snapshot().await)
    }
}

pub fn simulate_safe_ban_arbitration(
    config: &AutomationConfig,
    teammate_hovered_ids: &[i32],
    already_banned_ids: &[i32],
) -> BanArbitrationDecision {
    arbitrate_safe_ban(config, teammate_hovered_ids, already_banned_ids)
}

pub fn check_aram_bench_snipe(
    config: &AutomationConfig,
    current_champion_id: i32,
    bench_champion_ids: &[i32],
) -> Option<(i32, i32)> {
    diff_aram_bench_pool(config, current_champion_id, bench_champion_ids)
}

pub fn generate_spectator_launch_cmd(
    install_dir: &str,
    spectator_domain: &str,
    spectator_port: u16,
    encryption_key: &str,
    game_id: u64,
    platform_id: &str,
) -> String {
    build_sgp_spectator_command(
        install_dir,
        spectator_domain,
        spectator_port,
        encryption_key,
        game_id,
        platform_id,
    )
}

/// Initializes kernel state for Tauri 2 runtime
pub fn create_kernel_state() -> AppKernelState {
    AppKernelState {
        ring_buffer: Arc::new(IpcRingBuffer::new(256)),
        sgp_cache: Arc::new(SgpSessionCache::new()),
    }
}
