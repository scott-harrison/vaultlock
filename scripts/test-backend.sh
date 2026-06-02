#!/usr/bin/env sh
set -e

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Start (or reuse) the postgres container and wait until it is actually healthy
# and accepting connections. This prevents PoolTimedOut errors in the integration
# tests that create per-test databases (see backend/tests/common/mod.rs).
docker compose up postgres --wait -d

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://vaultlock:vaultlock@127.0.0.1:5432/vaultlock}"

exec cargo test --locked --manifest-path backend/Cargo.toml "$@"
