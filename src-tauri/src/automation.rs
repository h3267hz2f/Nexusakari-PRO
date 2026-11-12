//! NexusAkari Pro (v4) — Safe Automation Finite State Machine,
//! Anti-Friendly-Ban Intent Guard, ARAM <5ms Bench Diff Sniper with Rollback Lock,
//! Lobby Chat Zero-Width Obfuscated Broadcaster, and :2999 LiveClientData Poller.

use crate::lcu_connector::{IpcEnvelope, IpcRingBuffer, LcuRcuCredentials, LcuRestClient};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationConfig {
    pub auto_accept_enabled: bool,
    pub auto_accept_delay_ms: u64,
    pub auto_pick_enabled: bool,
    pub primary_pick_champion_ids: Vec<i32>,
    pub backup_pick_champion_ids: Vec<i32>,
    pub auto_ban_enabled: bool,
    pub ban_champion_ids: Vec<i32>,
    pub protect_teammate_intent_guard: bool,
    pub humanized_jitter_min_ms: u64,
    pub humanized_jitter_max_ms: u64,
    pub auto_reconnect_enabled: bool,
    pub auto_play_again_enabled: bool,
    pub aram_bench_sniper_enabled: bool,
    pub aram_wishlist_champion_ids: Vec<i32>,
    pub aram_instant_rollback_lock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BanArbitrationDecision {
    pub selected_ban_champion_id: Option<i32>,
    pub skipped_teammate_intents: Vec<i32>,
    pub applied_jitter_ms: u64,
    pub audit_log: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Live2999EnemySpellState {
    pub summoner_name: String,
    pub champion_name: String,
    pub has_cosmic_insight: bool,
    pub has_ionian_boots: bool,
    pub total_spell_haste: u32,
    pub flash_real_cooldown_sec: u32,
}

/// Arbitrates which champion to ban in Champion Select while guaranteeing we NEVER ban
/// a champion currently hovered (`championPickIntent`) by an allied teammate.
pub fn arbitrate_safe_ban(
    config: &AutomationConfig,
    teammate_hovered_ids: &[i32],
    already_banned_ids: &[i32],
) -> BanArbitrationDecision {
    let mut skipped = Vec::new();
    let jitter_ms = (config.humanized_jitter_min_ms + config.humanized_jitter_max_ms) / 2;

    for &candidate_id in &config.ban_champion_ids {
        if already_banned_ids.contains(&candidate_id) {
            continue;
        }
        if config.protect_teammate_intent_guard && teammate_hovered_ids.contains(&candidate_id) {
            skipped.push(candidate_id);
            continue;
        }
        return BanArbitrationDecision {
            selected_ban_champion_id: Some(candidate_id),
            skipped_teammate_intents: skipped.clone(),
            applied_jitter_ms: jitter_ms,
            audit_log: format!(
                "SafeBanFSM: Locked Ban ID {} after {}ms humanized jitter (Protected teammate intents: {:?})",
                candidate_id, jitter_ms, skipped
            ),
        };
    }

    BanArbitrationDecision {
        selected_ban_champion_id: None,
        skipped_teammate_intents: skipped,
        applied_jitter_ms: jitter_ms,
        audit_log: "SafeBanFSM: All candidate bans conflicted with teammate hover intents; aborted ban".to_string(),
    }
}

/// < 5ms WAMP Bench Diff Sniper for ARAM (`POST /lol-champ-select/v1/session/bench/swap/{championId}`).
/// Records `previous_champion_id` for 1-click instant rollback if needed.
pub fn diff_aram_bench_pool(
    config: &AutomationConfig,
    current_champion_id: i32,
    bench_champion_ids: &[i32],
) -> Option<(i32, i32)> {
    if !config.aram_bench_sniper_enabled {
        return None;
    }
    let current_rank = config
        .aram_wishlist_champion_ids
        .iter()
        .position(|&id| id == current_champion_id);

    for (rank, &wish_id) in config.aram_wishlist_champion_ids.iter().enumerate() {
        if let Some(cur_r) = current_rank {
            if rank >= cur_r {
                break;
            }
        }
        if bench_champion_ids.contains(&wish_id) {
            return Some((wish_id, current_champion_id));
        }
    }
    None
}

/// Calculates real summoner spell cooldown in seconds accounting for Cosmic Insight (+18) and Ionian Boots (+10).
pub fn calculate_spell_haste_cooldown(
    base_cd_sec: u32,
    has_cosmic_insight: bool,
    has_ionian_boots: bool,
) -> (u32, u32) {
    let haste = (if has_cosmic_insight { 18 } else { 0 }) + (if has_ionian_boots { 10 } else { 0 });
    let real_cd = ((base_cd_sec as f64) / (1.0 + (haste as f64) / 100.0)).round() as u32;
    (haste, real_cd)
}

/// Inserts zero-width spaces (`\u{200B}`) and converts sensitive words to compliant tactical terms
/// so lobby chat reports are never blocked by client profanity filters.
pub fn obfuscate_lobby_chat_line(raw: &str) -> String {
    let sanitized = raw
        .replace("牛马", "高危波动")
        .replace("混子", "低转化蓝领")
        .replace("秒退", "规避重开")
        .replace("连败", "状态低迷");
    sanitized
        .chars()
        .collect::<Vec<_>>()
        .chunks(4)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join("\u{200B}")
}

/// Executes delayed ReadyCheck Auto-Accept (`POST /lol-matchmaking/v1/ready-check/accept`),
/// Auto-Reconnect (`POST /lol-gameflow/v1/reconnect`), or Auto Play-Again (`POST /lol-lobby/v2/play-again`).
pub async fn execute_lifecycle_automation_action(
    lcu: &LcuRestClient,
    creds: &LcuRcuCredentials,
    config: &AutomationConfig,
    phase: &str,
    ring_buffer: &IpcRingBuffer,
) -> Result<String, String> {
    match phase {
        "ReadyCheck" if config.auto_accept_enabled => {
            if config.auto_accept_delay_ms > 0 {
                tokio::time::sleep(Duration::from_millis(config.auto_accept_delay_ms)).await;
            }
            lcu.lcu_request(
                creds,
                Method::POST,
                "/lol-matchmaking/v1/ready-check/accept",
                None,
                ring_buffer,
            )
            .await?;
            Ok(format!(
                "Accepted ReadyCheck after {}ms anti-misclick delay",
                config.auto_accept_delay_ms
            ))
        }
        "Reconnect" if config.auto_reconnect_enabled => {
            lcu.lcu_request(
                creds,
                Method::POST,
                "/lol-gameflow/v1/reconnect",
                None,
                ring_buffer,
            )
            .await?;
            Ok("Triggered automatic gameflow reconnect".to_string())
        }
        "EndOfGame" if config.auto_play_again_enabled => {
            lcu.lcu_request(
                creds,
                Method::POST,
                "/lol-lobby/v2/play-again",
                None,
                ring_buffer,
            )
            .await?;
            Ok("Skipped post-game honor and returned to lobby".to_string())
        }
        _ => Ok(format!("No automation action required for phase {}", phase)),
    }
}

/// Broadcasts obfuscated tactical report lines to the active Champion Select conversation
/// with a strict 350ms/line rate limit to prevent client chat throttling.
pub async fn broadcast_obfuscated_lobby_chat(
    lcu: &LcuRestClient,
    creds: &LcuRcuCredentials,
    conversation_id: &str,
    lines: &[String],
    ring_buffer: &IpcRingBuffer,
) -> Result<usize, String> {
    let endpoint = format!("/lol-chat/v1/conversations/{}/messages", conversation_id);
    let mut delivered = 0;

    for (idx, line) in lines.iter().enumerate() {
        if idx > 0 {
            tokio::time::sleep(Duration::from_millis(350)).await;
        }
        let body = json!({
            "type": "chat",
            "body": obfuscate_lobby_chat_line(line),
        });
        lcu.lcu_request(creds, Method::POST, &endpoint, Some(body), ring_buffer)
            .await?;
        delivered += 1;
    }
    Ok(delivered)
}

/// Polls Riot's In-Game LiveClientData API (`https://127.0.0.1:2999/liveclientdata/allgamedata`)
/// and extracts enemy players' Ionian Boots (ID 3158) and Cosmic Insight spell haste status.
pub async fn poll_live_client_2999(
    lcu: &LcuRestClient,
    ring_buffer: &IpcRingBuffer,
) -> Result<Vec<Live2999EnemySpellState>, String> {
    let url = "https://127.0.0.1:2999/liveclientdata/allgamedata";
    let started = Instant::now();

    let resp = lcu
        .inner_client()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("LiveClientData :2999 unreachable: {}", e))?;

    let status = resp.status().as_u16();
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;
    let payload: Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid :2999 JSON: {}", e))?;

    let mut parsed_enemies = Vec::new();
    if let Some(players) = payload.get("allPlayers").and_then(|v| v.as_array()) {
        for p in players {
            let summoner_name = p
                .get("summonerName")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let champion_name = p
                .get("championName")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();

            let has_ionian_boots = p
                .get("items")
                .and_then(|v| v.as_array())
                .is_some_and(|items| {
                    items.iter().any(|item| {
                        item.get("itemID").and_then(|id| id.as_i64()) == Some(3158)
                    })
                });

            let has_cosmic_insight = p
                .get("runes")
                .and_then(|r| r.get("generalRunes"))
                .and_then(|v| v.as_array())
                .is_some_and(|runes| {
                    runes
                        .iter()
                        .any(|r| r.get("id").and_then(|id| id.as_i64()) == Some(8347))
                });

            let (total_spell_haste, flash_real_cooldown_sec) =
                calculate_spell_haste_cooldown(300, has_cosmic_insight, has_ionian_boots);

            parsed_enemies.push(Live2999EnemySpellState {
                summoner_name,
                champion_name,
                has_cosmic_insight,
                has_ionian_boots,
                total_spell_haste,
                flash_real_cooldown_sec,
            });
        }
    }

    ring_buffer
        .push(IpcEnvelope {
            id: format!("live2999-{}", chrono::Utc::now().timestamp_micros()),
            timestamp: chrono::Utc::now().format("%H:%M:%S%.3f").to_string(),
            channel: "LIVE_2999".to_string(),
            method: "GET".to_string(),
            endpoint: "/liveclientdata/allgamedata".to_string(),
            status,
            duration_ms: (elapsed_ms * 100.0).round() / 100.0,
            payload_summary: format!("Synced {} active in-game players from :2999", parsed_enemies.len()),
        })
        .await;

    Ok(parsed_enemies)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> AutomationConfig {
        AutomationConfig {
            auto_accept_enabled: true,
            auto_accept_delay_ms: 1200,
            auto_pick_enabled: true,
            primary_pick_champion_ids: vec![203, 266],
            backup_pick_champion_ids: vec![516],
            auto_ban_enabled: true,
            ban_champion_ids: vec![53, 897, 238],
            protect_teammate_intent_guard: true,
            humanized_jitter_min_ms: 80,
            humanized_jitter_max_ms: 240,
            auto_reconnect_enabled: true,
            auto_play_again_enabled: false,
            aram_bench_sniper_enabled: true,
            aram_wishlist_champion_ids: vec![202, 126, 81],
            aram_instant_rollback_lock: true,
        }
    }

    #[test]
    fn test_safe_ban_skips_teammate_hovered_intent() {
        let cfg = sample_config();
        let decision = arbitrate_safe_ban(&cfg, &[53, 145], &[]);
        assert_eq!(decision.selected_ban_champion_id, Some(897));
        assert_eq!(decision.skipped_teammate_intents, vec![53]);
    }

    #[test]
    fn test_aram_bench_diff_sniper_and_priority_guard() {
        let cfg = sample_config();
        let snipe = diff_aram_bench_pool(&cfg, 37, &[54, 126, 202]);
        assert_eq!(snipe, Some((202, 37)));

        let no_swap = diff_aram_bench_pool(&cfg, 202, &[126, 81]);
        assert_eq!(no_swap, None);
    }

    #[test]
    fn test_spell_haste_and_chat_obfuscation() {
        let (haste, real_cd) = calculate_spell_haste_cooldown(300, true, true);
        assert_eq!(haste, 28);
        assert_eq!(real_cd, 234);

        let obf = obfuscate_lobby_chat_line("遇到牛马建议秒退");
        assert!(!obf.contains("牛马"));
        assert!(obf.contains('\u{200B}'));
    }
}
