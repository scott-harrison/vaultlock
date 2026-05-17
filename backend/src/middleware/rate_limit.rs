use std::time::Duration;
use tower_http::limit::RateLimitLayer;

/// Rate limiter: 5 requests per minute per IP
pub fn login_rate_limiter() -> RateLimitLayer {
    RateLimitLayer::new(5, Duration::from_secs(60))
}
