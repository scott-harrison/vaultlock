CREATE TABLE rate_limit_events (
    client_key TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_events_client_key_requested_at
    ON rate_limit_events (client_key, requested_at);
