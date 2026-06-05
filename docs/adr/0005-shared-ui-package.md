# ADR-0005: Shared UI Package (`@vaultlock/ui`)

**Status:** Accepted  
**Date:** June 5, 2026  
**Deciders:** VaultLock Engineering  
**Related Issues:** #201, #189 (Browser Extension Redesign 2026)

---

## Context

VaultLock ships multiple React clients (desktop Tauri app today; browser extension popup/options in Phase 1; mobile later). The desktop app already uses shadcn/ui (new-york) with a modern-minimal Tailwind theme. The extension Phase 1 plan requires visual parity without duplicating primitives in each client.

Duplicating `components/ui/*`, `cn()`, and CSS tokens across `desktop/` and `extension/` would drift quickly and inflate review surface.

## Decision

Introduce a workspace package **`@vaultlock/ui`** at `ui/` containing:

- shadcn/ui primitives (`button`, `input`, `badge`, `dialog`, `scroll-area`, `separator`, `tooltip`, `sonner`)
- `cn()` utility (`clsx` + `tailwind-merge`)
- Design tokens (`modern-minimal.css`) and shared global base styles (`globals.css`)
- `autofill-tokens.css` — CSS variables only for extension content-script shadow DOM (no Radix/Tailwind bundle on every tab)

**Consumers:**

| Client | Integration |
|--------|-------------|
| Desktop | Tailwind 4 + Vite; imports `@vaultlock/ui/styles/globals.css` |
| Extension (popup/options) | Tailwind 3 + PostCSS (Plasmo); same CSS import (#214) |
| Content scripts | `autofill-tokens.css` only |

**Out of scope for v1:** Vault-specific feature components (`VaultScreen`, `PasswordGeneratorDialog`) remain in `desktop/` until a second client needs them.

## Consequences

**Positive:**

- Single source of truth for shadcn primitives and theme tokens
- Extension Phase 1 UI work imports the same components as desktop
- shadcn CLI config lives in `ui/components.json`

**Negative / trade-offs:**

- Desktop and extension may use different Tailwind major versions (TW4 vs TW3); parity is via shared CSS variables, not identical Tailwind configs
- UI package adds peer dependency alignment on React across clients
- Radix and shadcn deps are centralized; consumers must not re-declare duplicate copies

## Security

`@vaultlock/ui` is presentation-only. It must not depend on `@vaultlock/shared` crypto or handle secrets. Content scripts must not import full UI components into page context — tokens CSS only per AGENTS.md §6.