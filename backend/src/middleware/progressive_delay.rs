use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Simple in-memory progressive delay for failed logins
/// In production, this should be moved to Redis or database
pub struct ProgressiveDelay {
    attempts: Mutex<HashMap<String, (u32, Instant)>>,
}

impl ProgressiveDelay {
    pub fn new() -> Self {
        Self {
            attempts: Mutex::new(HashMap::new()),
        }
    }

    /// Returns the delay duration for this identifier (email or IP)
    pub fn get_delay(&self, identifier: &str) -> Duration {
        let mut attempts = self.attempts.lock().unwrap();
        let (count, last_attempt) = attempts.entry(identifier.to_string()).or_insert((0, Instant::now()));

        // Reset if more than 10 minutes since last attempt
        if last_attempt.elapsed() > Duration::from_secs(600) {
            *count = 0;
        }

        let delay_ms = match *count {
            0..=2 => 0,
            3..=5 => 300,
            6..=10 => 1000,
            _ => 2000,
        };

        *count += 1;
        *last_attempt = Instant::now();

        Duration::from_millis(delay_ms)
    }
}