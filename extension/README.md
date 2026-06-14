# VaultLock Browser Extension

Manifest V3 extension (Plasmo + React) for VaultLock. Part of **Epic #189** (Browser Extension Redesign 2026); Phase 0 reliability work tracks **#187**.

## Current capabilities (Phase 0)

- Server URL + connection test (options page)
- Sign in / unlock with zero-knowledge crypto (`@vaultlock/shared`)
- Encrypted vault cache in `chrome.storage.local` (background sync, popup decrypts)
- On-demand sync (login, unlock, empty cache, manual ↻ — not on every popup open)
- Fill-on-click: **VL** indicator on detectable password fields → popup → **Fill**
- Password generator available in `@vaultlock/shared` (desktop uses it; extension UI in Phase 1)

**Limits:** Many sites (Apple ID, iframe OAuth, shadow DOM) do not show indicators yet. Use copy-from-popup or wait for Phase 2 detection work (#190).

## Prerequisites

- Node 22+ and pnpm 11 (see repo root `.nvmrc`)
- VaultLock backend running (see `DEV_ENVIRONMENT.md`)
- From repo root: `pnpm install`

## Development

```bash
# From repo root
pnpm extension:dev          # Chrome
pnpm extension:dev:brave    # Brave (recommended if you use Brave daily)
```

The dev runner (`extension/scripts/plasmo-dev.mjs`) patches the dev manifest every ~1.5s so it keeps:

- `permissions`: `storage`, `tabs`
- `host_permissions`: `<all_urls>`
- CSP `wasm-unsafe-eval` for Argon2 in the popup

**After starting dev:** open `brave://extensions` (or `chrome://extensions`) and **Reload** the extension if you change permissions or see `chrome.storage.local` undefined on login.

### Dev vs production builds

| Use case | Command | Load unpacked from |
|----------|---------|-------------------|
| Active coding / HMR | `pnpm extension:dev:brave` | `extension/build/brave-mv3-dev` |
| Testing fill, sync, reload stability | `pnpm extension:build:brave` | `extension/build/brave-mv3-prod` |

Prefer **prod build** when testing autofill or avoiding Plasmo HMR noise (“Context invalidated”, extra localhost prompts).

```bash
pnpm extension:build:brave   # or pnpm extension:build for Chrome
```

## Manual test checklist (Phase 0)

1. **Options:** set server URL, test connection, save.
2. **Sign in / unlock** in popup — no `storage.local` errors (reload extension if you see them).
3. **Sync:** open popup with cached items — Network tab should not spam `GET /vault/items` on every open; use ↻ to refresh.
4. **Fill-on-click:** on a page with a normal `input[type="password"]` (http/https):
   - Blue **VL** badge on the field
   - Click **VL** → unlock if needed → **Fill** on a matching login
   - Username and password appear in the page
5. **Reload stress:** reload extension 5× in `brave://extensions` — no `MAX_WRITE_OPERATIONS_PER_MINUTE` in service worker console (migration must not touch `chrome.storage.sync` after first run; see #191).

## Project layout

```
extension/
├── src/
│   ├── background.ts              # Sync, fill relay, message validation
│   ├── popup.tsx / options.tsx
│   ├── contents/
│   │   └── password-field-detector.ts
│   └── lib/                       # storage, auth, vaultSession, form fill, etc.
├── scripts/
│   ├── plasmo-dev.mjs             # Dev runner + manifest patch
│   └── patch-extension-csp.mjs
└── plasmo.config.ts
```

## Security notes

- Encryption and key derivation use `@vaultlock/shared` only in extension pages (popup/options), not in the page DOM.
- Background stores **ciphertext** only; DEK stays in popup memory while unlocked.
- `host_permissions: <all_urls>` is required for content scripts today; narrowing is tracked in **#180**.

## References

- Redesign plan: `docs/plans/browser-extension-redesign-2026.md`
- Parent epic: https://github.com/scott-harrison/vaultlock/issues/189
- Phase 0 umbrella: https://github.com/scott-harrison/vaultlock/issues/187
- Shared package: `../shared/`