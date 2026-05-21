#!/usr/bin/env sh
set -e

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose up postgres -d

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://vaultlock:vaultlock@127.0.0.1:5432/vaultlock}"

exec cargo test --locked --manifest-path backend/Cargo.toml "$@"
