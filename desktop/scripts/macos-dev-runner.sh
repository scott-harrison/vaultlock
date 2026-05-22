#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$(cd "$SCRIPT_DIR/../src-tauri" && pwd)"
cd "$TAURI_DIR"

# Tauri invokes the runner like: run [cargo flags] -- [app args]
args=("$@")
if [[ "${args[0]:-}" == "run" ]]; then
  args=("${args[@]:1}")
fi

cargo_args=()
bin_args=()
found_separator=false
for arg in "${args[@]}"; do
  if [[ "$arg" == "--" && "$found_separator" == false ]]; then
    found_separator=true
    continue
  fi
  if [[ "$found_separator" == true ]]; then
    bin_args+=("$arg")
  else
    cargo_args+=("$arg")
  fi
done

cargo build "${cargo_args[@]}"

BINARY="$TAURI_DIR/target/debug/desktop"
ENTITLEMENTS="$TAURI_DIR/Entitlements.plist"

if [[ -f "$ENTITLEMENTS" && -f "$BINARY" ]]; then
  codesign --force --sign - \
    --identifier com.vaultlock.desktop \
    --entitlements "$ENTITLEMENTS" \
    "$BINARY"
fi

if ((${#bin_args[@]} > 0)); then
  exec cargo run "${cargo_args[@]}" -- "${bin_args[@]}"
fi

exec cargo run "${cargo_args[@]}" --
