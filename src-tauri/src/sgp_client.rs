//! NexusAkari Pro (v4) — SGP (Service Gateway Proxy) JWT Client, Token-Bucket Rate Limiter,
//! DashMap L1/L2 PUUID Cache, and Direct Cross-Region OB Spectator Command Builder.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SgpEndpointConfig {
    pub region_code: String,
    pub region_name: String,
    pub operator: String,
    pub match_history_url: String,
    pub summoner_ledge_url: String,
    pub spectator_domain: String,
    pub spectator_port: u16,
    pub latency_ms: u32,
}

/// Token-Bucket Rate Limiter preventing HTTP 429 Too Many Requests when pulling
/// 10 players x 20 matches simultaneously during Champion Select.
pub struct TokenBucketLimiter {
    capacity: f64,
    refill_rate_per_sec: f64,
    state: Mutex<(f64, Instant)>,
}

impl TokenBucketLimiter {
    pub fn new(capacity: f64, refill_rate_per_sec: f64) -> Self {
        Self {
            capacity,
            refill_rate_per_sec,
            state: Mutex::new((capacity, Instant::now())),
        }
    }

    pub async fn acquire_one(&self) -> f64 {
        loop {
            {
                let mut guard = self.state.lock().await;
                let now = Instant::now();
                let elapsed = now.duration_since(guard.1).as_secs_f64();
                guard.0 = (guard.0 + elapsed * self.refill_rate_per_sec).min(self.capacity);
                guard.1 = now;

                if guard.0 >= 1.0 {
                    guard.0 -= 1.0;
                    return guard.0;
                }
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }

    pub async fn available_tokens(&self) -> u32 {
        let mut guard = self.state.lock().await;
        let now = Instant::now();
        let elapsed = now.duration_since(guard.1).as_secs_f64();
        guard.0 = (guard.0 + elapsed * self.refill_rate_per_sec).min(self.capacity);
        guard.1 = now;
        guard.0.floor() as u32
    }
}

/// High-concurrency DashMap L1 PUUID Match Summary Cache
pub struct SgpSessionCache {
    pub summaries: Arc<DashMap<String, serde_json::Value>>,
    pub limiter: Arc<TokenBucketLimiter>,
}

impl Default for SgpSessionCache {
    fn default() -> Self {
        Self::new()
    }
}

impl SgpSessionCache {
    pub fn new() -> Self {
        Self {
            summaries: Arc::new(DashMap::with_capacity(2048)),
            limiter: Arc::new(TokenBucketLimiter::new(15.0, 15.0)),
        }
    }
}

/// Builds the direct client command line to launch delay-free cross-region OB Spectating
/// via SGP observerEncryptionKey without waiting on LCU friend lobby locks.
pub fn build_sgp_spectator_command(
    install_dir: &str,
    spectator_domain: &str,
    spectator_port: u16,
    encryption_key: &str,
    game_id: u64,
    platform_id: &str,
) -> String {
    format!(
        "\"{}\\Game\\League of Legends.exe\" \"spectator {}:{} {} {} {}\" -UseRads -Locale=zh_CN",
        install_dir.trim_end_matches('\\'),
        spectator_domain,
        spectator_port,
        encryption_key,
        game_id,
        platform_id
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_token_bucket_acquires_and_tracks_balance() {
        let limiter = TokenBucketLimiter::new(5.0, 10.0);
        let remaining = limiter.acquire_one().await;
        assert!(remaining >= 3.9 && remaining <= 4.1);
        let avail = limiter.available_tokens().await;
        assert_eq!(avail, 4);
    }

    #[test]
    fn test_build_sgp_spectator_command_formatting() {
        let cmd = build_sgp_spectator_command(
            "D:\\WeGameApps\\英雄联盟\\LeagueClient\\",
            "spectator.hn1.lol.qq.com",
            8080,
            "encKey9981",
            784512098,
            "HN1",
        );
        assert!(cmd.contains("spectator spectator.hn1.lol.qq.com:8080 encKey9981 784512098 HN1"));
    }
}
