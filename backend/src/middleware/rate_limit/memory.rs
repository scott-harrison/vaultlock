use super::{max_requests, window};
use axum::http::StatusCode;
use std::{
    collections::HashMap,
    sync::Arc,
    time::Instant,
};
use tokio::sync::Mutex;

#[derive(Clone, Default)]
pub struct MemoryStore {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self::default()
    }

    #[allow(clippy::significant_drop_tightening)]
    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        let now = Instant::now();
        let mut requests = self.requests.lock().await;
        let timestamps = requests.entry(key.to_string()).or_default();
        timestamps.retain(|t| now.duration_since(*t) < window());

        if timestamps.len() >= max_requests() {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }

        timestamps.push(now);
        Ok(())
    }
}
