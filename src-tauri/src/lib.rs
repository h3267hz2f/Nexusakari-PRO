//! NexusAkari Pro (v4) — Tauri 2 Core Library & Complete 14-Command IPC Kernel
//! Bridges `LcuRestClient`, `SgpHttpClient`, `IpcRingBuffer`, `spawn_pid_watchdog`,
//! and `:2999` LiveClientData into a unified async state controller.

pub mod automation;
pub mod lcu_connector;
pub mod sgp_client;

use automation::{
    arbitrate_safe_ban, broadcast_obfuscated_lobby_chat, diff_aram_bench_pool,
    execute_lifecycle_automation_action, poll_live_client_2999, AutomationConfig,
    BanArbitrationDecision, Live2999EnemySpellState,
};
use lcu_connector::{
    scan_dual_process_credentials, spawn_pid_watchdog, IpcEnvelope, IpcRingBuffer,
    LcuRcuCredentials, LcuRestClient, RsoEntitlementsToken,
};
use reqwest::Method;
use serde_json::{json, Value};
use sgp_client::{
    build_sgp_spectator_command, default_sgp_region_registry, SgpEndpointConfig, SgpHttpClient,
    SgpSessionCache,
};
use std::sync::Arc;
use tokio::sync::{watch, RwLock};

pub struct AppKernelState {
    pub lcu_client: LcuRestClient,
    pub sgp_client: SgpHttpClient,
    pub ring_buffer: Arc<IpcRingBuffer>,
    pub sgp_cache: Arc<SgpSessionCache>,
    pub credentials: Arc<RwLock<Option<LcuRcuCredentials>>>,
    pub active_region: RwLock<String>,
    pub automation_config: RwLock<AutomationConfig>,
    pub watchdog_shutdown_tx: watch::Sender<bool>,
}

impl AppKernelState {
    /// 1. Scans or returns active LCU + RCU 4-tuple credentials
    pub async fn probe_lcu_rcu_credentials(&self) -> Result<Option<LcuRcuCredentials>, String> {
        let creds = scan_dual_process_credentials();
        if let Some(ref c) = creds {
            let mut guard = self.credentials.write().await;
            *guard = Some(c.clone());
        }
        self.ring_buffer
            .push(IpcEnvelope {
                id: format!("ipc-{}", chrono::Utc::now().timestamp_micros()),
                timestamp: chrono::Utc::now().format("%H:%M:%S%.3f").to_string(),
                channel: "TAURI_CMD".to_string(),
                method: "INVOKE".to_string(),
                endpoint: "probe_lcu_rcu_credentials".to_string(),
                status: if creds.is_some() { 200 } else { 404 },
                duration_ms: 1.1,
                payload_summary: "Scanned LeagueClientUx & RiotClientServices PEB command line"
                    .to_string(),
            })
            .await;
        Ok(creds)
    }

    /// 2. Returns snapshot of fixed-capacity 256-frame IPC RingBuffer
    pub async fn get_ipc_ring_buffer(&self) -> Result<Vec<IpcEnvelope>, String> {
        Ok(self.ring_buffer.snapshot().await)
    }

    /// 3. Starts the 2-second PID Hot-Reload Watchdog task
    pub fn start_background_watchdog(&self) -> tokio::task::JoinHandle<()> {
        let creds_ref = Arc::clone(&self.credentials);
        let rb_ref = Arc::clone(&self.ring_buffer);
        let rx = self.watchdog_shutdown_tx.subscribe();
        spawn_pid_watchdog(creds_ref, rb_ref, rx)
    }

    /// 4. Acquires RSO JWT from RCU `/entitlements/v1/token`
    pub async fn acquire_rso_jwt(&self) -> Result<RsoEntitlementsToken, String> {
        let creds_opt = self.credentials.read().await.clone();
        let creds = creds_opt.ok_or_else(|| "LCU/RCU credentials not attached".to_string())?;
        self.lcu_client
            .fetch_rcu_entitlements_jwt(&creds, &self.ring_buffer)
            .await
    }

    /// 5. Queries 10 players' match histories concurrently via SGP TokenBucket & DashMap
    pub async fn batch_scout_sgp_players(
        &self,
        puuids: Vec<String>,
    ) -> Result<Vec<(String, Result<Value, String>)>, String> {
        let region_code = self.active_region.read().await.clone();
        let regions = default_sgp_region_registry();
        let endpoint_cfg = regions
            .into_iter()
            .find(|r| r.region_code == region_code)
            .unwrap_or_else(|| default_sgp_region_registry().remove(0));

        let rso = self.acquire_rso_jwt().await?;
        Ok(self
            .sgp_client
            .batch_scout_players(
                endpoint_cfg,
                rso.access_token,
                puuids,
                Arc::clone(&self.sgp_cache),
                Arc::clone(&self.ring_buffer),
            )
            .await)
    }

    /// 6. Hot-injects a complete 9-perk Rune Page into LCU (`/lol-perks/v1/currentpage` + `/lol-perks/v1/pages`)
    pub async fn inject_lcu_rune_page(
        &self,
        page_name: &str,
        primary_style_id: i32,
        sub_style_id: i32,
        selected_perk_ids: Vec<i32>,
    ) -> Result<Value, String> {
        let creds = self
            .credentials
            .read()
            .await
            .clone()
            .ok_or_else(|| "LCU not connected".to_string())?;

        if let Ok(curr) = self
            .lcu_client
            .lcu_request(
                &creds,
                Method::GET,
                "/lol-perks/v1/currentpage",
                None,
                &self.ring_buffer,
            )
            .await
        {
            if let Some(page_id) = curr.get("id").and_then(|v| v.as_i64()) {
                let _ = self
                    .lcu_client
                    .lcu_request(
                        &creds,
                        Method::DELETE,
                        &format!("/lol-perks/v1/pages/{}", page_id),
                        None,
                        &self.ring_buffer,
                    )
                    .await;
            }
        }

        let payload = json!({
            "name": page_name,
            "primaryStyleId": primary_style_id,
            "subStyleId": sub_style_id,
            "selectedPerkIds": selected_perk_ids,
            "current": true
        });
        self.lcu_client
            .lcu_request(
                &creds,
                Method::POST,
                "/lol-perks/v1/pages",
                Some(payload),
                &self.ring_buffer,
            )
            .await
    }

    /// 7. Executes ARAM <5ms Bench Swap (`POST /lol-champ-select/v1/session/bench/swap/{championId}`)
    pub async fn execute_lcu_aram_bench_swap(&self, target_champion_id: i32) -> Result<Value, String> {
        let creds = self
            .credentials
            .read()
            .await
            .clone()
            .ok_or_else(|| "LCU not connected".to_string())?;
        let ep = format!(
            "/lol-champ-select/v1/session/bench/swap/{}",
            target_champion_id
        );
        self.lcu_client
            .lcu_request(&creds, Method::POST, &ep, None, &self.ring_buffer)
            .await
    }

    /// 8. Executes Hextech Loot batch craft disenchanting (`POST /lol-loot/v1/recipes/{recipe}/craft?repeat={n}`)
    pub async fn execute_lcu_loot_batch_craft(
        &self,
        commands: Vec<(String, String, u32)>,
    ) -> Result<usize, String> {
        let creds = self
            .credentials
            .read()
            .await
            .clone()
            .ok_or_else(|| "LCU not connected".to_string())?;
        let mut crafted = 0;
        for (recipe_name, loot_id, repeat) in commands {
            let ep = format!("/lol-loot/v1/recipes/{}/craft?repeat={}", recipe_name, repeat);
            let body = json!([loot_id]);
            self.lcu_client
                .lcu_request(&creds, Method::POST, &ep, Some(body), &self.ring_buffer)
                .await?;
            crafted += 1;
        }
        Ok(crafted)
    }

    /// 9. Applies profile skin splash background and ranked tier/crystal spoof
    pub async fn apply_lcu_cosmetic_spoof(
        &self,
        background_skin_id: i32,
        spoof_tier: &str,
        spoof_division: &str,
        spoof_lp: i32,
        crystal_level: &str,
        status_message: &str,
    ) -> Result<Vec<String>, String> {
        let creds = self
            .credentials
            .read()
            .await
            .clone()
            .ok_or_else(|| "LCU not connected".to_string())?;

        let profile_body = json!({
            "key": "backgroundSkinId",
            "value": background_skin_id
        });
        self.lcu_client
            .lcu_request(
                &creds,
                Method::POST,
                "/lol-summoner/v1/current-summoner/summoner-profile",
                Some(profile_body),
                &self.ring_buffer,
            )
            .await?;

        let chat_body = json!({
            "statusMessage": status_message,
            "lol": {
                "rankedLeagueQueue": "RANKED_SOLO_5x5",
                "rankedLeagueTier": spoof_tier,
                "rankedLeagueDivision": spoof_division,
                "rankedLosses": String::from("0"),
                "rankedSplitRewardLevel": "3",
                "challengeCrystalLevel": crystal_level,
                "rankedPrevSeasonTier": spoof_tier,
                "rankedLeagueLp": spoof_lp.to_string()
            }
        });
        self.lcu_client
            .lcu_request(
                &creds,
                Method::PUT,
                "/lol-chat/v1/me",
                Some(chat_body),
                &self.ring_buffer,
            )
            .await?;

        Ok(vec![
            "POST /lol-summoner/v1/current-summoner/summoner-profile".to_string(),
            "PUT /lol-chat/v1/me".to_string(),
        ])
    }

    /// 10. Creates 5v5 Practice Tool Custom Lobby (`POST /lol-lobby/v2/lobby`)
    pub async fn create_lcu_practice_lobby(
        &self,
        lobby_name: &str,
        team_size: u8,
    ) -> Result<Value, String> {
        let creds = self
            .credentials
            .read()
            .await
            .clone()
            .ok_or_else(|| "LCU not connected".to_string())?;
        let payload = json!({
            "customGameLobby": {
                "configuration": {
                    "gameMode": "PRACTICETOOL",
                    "gameMutator": "",
                    "gameServerRegion": "",
                    "mapId": 11,
                    "mutators": { "id": 1 },
                    "spectatorPolicy": "AllAllowed",
                    "teamSize": team_size
                },
                "lobbyName": lobby_name,
                "lobbyPassword": null
            },
            "isCustom": true
        });
        self.lcu_client
            .lcu_request(
                &creds,
                Method::POST,
                "/lol-lobby/v2/lobby",
                Some(payload),
                &self.ring_buffer,
            )
            .await
    }

    /// 11. Broadcasts obfuscated tactical report to Champion Select chat
    pub async fn broadcast_lcu_lobby_chat(
        &self,
        conversation_id: &str,
        lines: Vec<String>,
    ) -> Result<usize, String> {
        let creds = self
            .credentials
            .read()
            .await
            .clone()
            .ok_or_else(|| "LCU not connected".to_string())?;
        broadcast_obfuscated_lobby_chat(
            &self.lcu_client,
            &creds,
            conversation_id,
            &lines,
            &self.ring_buffer,
        )
        .await
    }

    /// 12. Polls `:2999` In-Game LiveClientData for enemy spell haste & Flash cooldowns
    pub async fn poll_live_2999_spells(&self) -> Result<Vec<Live2999EnemySpellState>, String> {
        poll_live_client_2999(&self.lcu_client, &self.ring_buffer).await
    }

    /// 13. Triggers lifecycle automation (Auto-Accept / Auto-Reconnect / Auto Play-Again)
    pub async fn run_lifecycle_automation(&self, phase: &str) -> Result<String, String> {
        let creds = self
            .credentials
            .read()
            .await
            .clone()
            .ok_or_else(|| "LCU not connected".to_string())?;
        let cfg = self.automation_config.read().await.clone();
        execute_lifecycle_automation_action(&self.lcu_client, &creds, &cfg, phase, &self.ring_buffer)
            .await
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

pub fn get_sgp_regions() -> Vec<SgpEndpointConfig> {
    default_sgp_region_registry()
}

/// Initializes kernel state for Tauri 2 runtime
pub fn create_kernel_state() -> AppKernelState {
    let (shutdown_tx, _) = watch::channel(false);
    AppKernelState {
        lcu_client: LcuRestClient::new(),
        sgp_client: SgpHttpClient::new(),
        ring_buffer: Arc::new(IpcRingBuffer::new(256)),
        sgp_cache: Arc::new(SgpSessionCache::new()),
        credentials: Arc::new(RwLock::new(None)),
        active_region: RwLock::new("HN1".to_string()),
        automation_config: RwLock::new(AutomationConfig {
            auto_accept_enabled: true,
            auto_accept_delay_ms: 1200,
            auto_pick_enabled: true,
            primary_pick_champion_ids: vec![203, 516],
            backup_pick_champion_ids: vec![412],
            auto_ban_enabled: true,
            ban_champion_ids: vec![53, 897, 238],
            protect_teammate_intent_guard: true,
            humanized_jitter_min_ms: 85,
            humanized_jitter_max_ms: 260,
            auto_reconnect_enabled: true,
            auto_play_again_enabled: false,
            aram_bench_sniper_enabled: true,
            aram_wishlist_champion_ids: vec![202, 126, 81],
            aram_instant_rollback_lock: true,
        }),
        watchdog_shutdown_tx: shutdown_tx,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_kernel_state_initialization_and_ring_buffer_recording() {
        let state = create_kernel_state();
        let _ = state.probe_lcu_rcu_credentials().await;
        let frames = state.get_ipc_ring_buffer().await.unwrap();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].endpoint, "probe_lcu_rcu_credentials");
        assert_eq!(get_sgp_regions().len(), 5);
    }
}
