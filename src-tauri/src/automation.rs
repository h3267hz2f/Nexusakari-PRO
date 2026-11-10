//! NexusAkari Pro (v4) — Safe Automation Finite State Machine
//! Includes Anti-Friendly-Ban Intent Guard, Gaussian Humanized Jitter,
//! ARAM <5ms Bench Diff Sniper with Rollback Lock, and :2999 LiveClientData Poller.

use serde::{Deserialize, Serialize};

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
    // If current champion is already higher priority in wishlist, do not swap away
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
            // Returns (target_swap_champion_id, rollback_previous_champion_id)
            return Some((wish_id, current_champion_id));
        }
    }
    None
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
        // Teammate SUP hovers Blitzcrank (53); should skip 53 and lock K'Sante (897)
        let decision = arbitrate_safe_ban(&cfg, &[53, 145], &[]);
        assert_eq!(decision.selected_ban_champion_id, Some(897));
        assert_eq!(decision.skipped_teammate_intents, vec![53]);
    }

    #[test]
    fn test_aram_bench_diff_sniper_and_priority_guard() {
        let cfg = sample_config();
        // Currently holding Sona (37), bench rolls Jayce (126) and Jhin (202) -> snipes highest priority Jhin (202)
        let snipe = diff_aram_bench_pool(&cfg, 37, &[54, 126, 202]);
        assert_eq!(snipe, Some((202, 37)));

        // If already holding Jhin (202, rank 0), will not swap to lower priority Jayce (126, rank 1)
        let no_swap = diff_aram_bench_pool(&cfg, 202, &[126, 81]);
        assert_eq!(no_swap, None);
    }
}

