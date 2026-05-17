#![allow(clippy::duration_suboptimal_units)]

use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

/// Delays applied before processing the next login attempt, keyed by prior failure count.
/// 0 failures → 0s, then 30s → 5m → 30m → 1h → 1d (capped).
const FAILURE_DELAYS: &[Duration] = &[
    Duration::ZERO,
    Duration::from_secs(30),
    Duration::from_secs(5 * 60),
    Duration::from_secs(30 * 60),
    Duration::from_secs(60 * 60),
    Duration::from_secs(24 * 60 * 60),
];

/// Reset failure count after this idle period (successful logins clear immediately).
const IDLE_RESET: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Debug, Clone)]
struct Entry {
    failure_count: u32,
    last_failure: Instant,
}

/// In-memory progressive delay for failed logins. In production, use Redis or the database.
#[derive(Clone)]
pub struct ProgressiveDelay {
    attempts: Arc<Mutex<HashMap<String, Entry>>>,
}

impl ProgressiveDelay {
    pub fn new() -> Self {
        Self {
            attempts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Sleep before handling a login, based on how many prior failures this identifier has.
    pub async fn wait_before_login(&self, identifier: &str) {
        let delay = self.current_delay(identifier).await;
        if !delay.is_zero() {
            tokio::time::sleep(delay).await;
        }
    }

    #[allow(clippy::significant_drop_tightening)]
    pub async fn record_failure(&self, identifier: &str) {
        let key = normalize_identifier(identifier);
        let mut attempts = self.attempts.lock().await;
        let entry = attempts.entry(key).or_insert_with(|| Entry {
            failure_count: 0,
            last_failure: Instant::now(),
        });

        if entry.last_failure.elapsed() > IDLE_RESET {
            entry.failure_count = 0;
        }

        entry.failure_count = entry.failure_count.saturating_add(1);
        entry.last_failure = Instant::now();
    }

    pub async fn clear(&self, identifier: &str) {
        self.attempts
            .lock()
            .await
            .remove(&normalize_identifier(identifier));
    }

    async fn current_delay(&self, identifier: &str) -> Duration {
        let key = normalize_identifier(identifier);
        let count = {
            let attempts = self.attempts.lock().await;
            attempts
                .get(&key)
                .filter(|entry| entry.last_failure.elapsed() <= IDLE_RESET)
                .map_or(0, |entry| entry.failure_count)
        };

        delay_for_failure_count(count)
    }
}

fn normalize_identifier(identifier: &str) -> String {
    identifier.trim().to_lowercase()
}

fn delay_for_failure_count(failure_count: u32) -> Duration {
    let max_index = FAILURE_DELAYS.len() - 1;
    let index = (failure_count as usize).min(max_index);
    FAILURE_DELAYS[index]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delay_schedule_matches_spec() {
        assert_eq!(delay_for_failure_count(0), Duration::ZERO);
        assert_eq!(delay_for_failure_count(1), Duration::from_secs(30));
        assert_eq!(delay_for_failure_count(2), Duration::from_secs(5 * 60));
        assert_eq!(delay_for_failure_count(3), Duration::from_secs(30 * 60));
        assert_eq!(delay_for_failure_count(4), Duration::from_secs(60 * 60));
        assert_eq!(
            delay_for_failure_count(5),
            Duration::from_secs(24 * 60 * 60)
        );
        assert_eq!(
            delay_for_failure_count(100),
            Duration::from_secs(24 * 60 * 60)
        );
    }

    #[tokio::test]
    async fn successful_login_clears_failures() {
        let delay = ProgressiveDelay::new();
        let id = "user@example.com";

        delay.record_failure(id).await;
        delay.record_failure(id).await;
        assert_eq!(delay.current_delay(id).await, Duration::from_secs(5 * 60));

        delay.clear(id).await;
        assert_eq!(delay.current_delay(id).await, Duration::ZERO);
    }
}
