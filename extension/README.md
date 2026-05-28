# VaultLock Browser Extension

This is the browser extension for VaultLock (Manifest V3 + Plasmo).

## Current Status

This directory is being developed as part of **Epic #12** (see GitHub issue #10).

### Sub-task Progress

- [x] **12-01: Plasmo scaffold** — Basic structure, dev/build pipeline, integration with `@vaultlock/shared`
- [ ] 12-02: Server connection settings + health check
- [ ] 12-03: Shared crypto integration
- [ ] 12-04: Auth + master password unlock
- [ ] ... (see issue #10 for full list)

## Running the Extension

From the repository root:

```bash
# One-time
pnpm install

# Development (Chrome)
cd extension
pnpm dev

# Production build
pnpm build
```

The `plasmo dev` command will open a new Chrome window with the extension loaded in development mode (hot reloading).

## Folder Structure

```
extension/
├── src/
│   ├── popup.tsx           # Extension popup UI
│   ├── options.tsx         # Options page (opens in tab)
│   ├── background.ts       # Service worker
│   └── content.ts          # (Future) Content script for autofill
├── plasmo.config.ts        # Plasmo + Manifest V3 configuration
├── tsconfig.json
├── biome.json              # Extends root config
└── package.json
```

## Important Notes

- We consume `@vaultlock/shared` via pnpm workspaces (`workspace:*`).
- All encryption/decryption happens client-side using code from `@vaultlock/shared`.
- The server never sees plaintext or keys.
- Follow the patterns established in the desktop app (`desktop/src/lib/`) where possible.

## References

- Main epic: https://github.com/scott-harrison/vaultlock/issues/10
- Shared package: `../shared/`
- Desktop implementation (for reference): `../desktop/`
