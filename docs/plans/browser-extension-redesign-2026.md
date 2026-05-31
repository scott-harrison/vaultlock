# Plan: Redesign VaultLock Browser Extension for NordPass/LastPass-like Experience

## Context
The current browser extension (Plasmo MV3 + React) is a functional but incomplete vault viewer:
- Basic popup for login/unlock + decrypted vault list with copy.
- Skeleton "fill on click": password-field-detector injects indicators and sends `INDICATOR_CLICKED`; background stores `pendingFillRequest` and opens popup; popup shows a "autofill support in progress" banner.
- Background-driven encrypted cache with `performVaultSync`, debounced triggers, and heavy storage guards (due to past quota crashes on reloads).
- No actual form filling, no save-on-submit prompts, no password generator in web forms, no context menus, minimal domain matching, and fragile sync under MV3 service worker churn (repeated `MAX_WRITE_OPERATIONS_PER_MINUTE` on reloads, eager triggers from popup mounts + `ENCRYPTED_VAULT_CACHE_UPDATED`).

This makes it "not fit for purpose" as a daily driver. Users expect password managers' browser extensions (NordPass, LastPass, 1Password) to be the **primary interface** on the web: seamless inline autofill, effortless saving of new logins, password generation at the point of need, and rock-solid reliability.

**Security is non-negotiable and the #1 filter for every decision in this redesign** (per AGENTS.md Section 6 and the project's core mission). Any proposed feature, permission, or architectural change must pass the Mandatory Security Review Checklist. We will not ship anything that weakens the zero-knowledge model, increases the attack surface for the DEK or plaintext, or makes the server any less "dumb and blind."

The desktop app uses a simpler on-demand sync model that has proven more robust. The extension's ambitious "background keeps encrypted cache warm" design (motivated by ephemeral popup + future autofill needs) has introduced quota noise, sync spam, reload fragility, and over-engineering relative to delivered value.

User priorities (from discussion):
- All core flows: inline one-click autofill, save prompts, generator in forms, **and** reliable popup vault.
- Simplify sync/cache model toward desktop's on-demand approach.
- Full domain matching sophistication (user-managed related domains).
- Constraints: Minimize new permissions/complexity, prioritize dev experience (HMR/reload reliability), align with existing PROJECT_PLAN phases, deliver excellent UX without requiring 100% feature parity immediately.

## Recommended Approach
**Holistic redesign in phases**, with two parallel tracks executed together:
1. **Reliability & Simplification Track** (unblocks everything): Move away from constant background cache warming and frequent polling. Adopt more on-demand patterns (popup/content trigger targeted sync/decrypt when needed). Fully eliminate legacy `chrome.storage.sync` touches. Harden dev experience (suppress HMR noise properly, clear guidance for testing).
2. **Consumer Autofill UX Track**: Build on the existing strong field detector heuristics. Add real filling, save detection + prompts, generator injection, proper matching (including per-item related domains), and polished inline flows. Leverage existing background DEK relay (`backgroundVaultSession`) for autofill readiness without popup.

**Sync simplification strategy** (directly addresses the main race risk): Background remains the single trusted network/sync engine (with our existing 10s fetch / 8s write guards + in-progress flag). Popup and content scripts become "consumers" that request data via messages (`REQUEST_ENCRYPTED_VAULT` with optional domain filter for autofill, `REQUEST_SYNC_IF_STALE`). This eliminates the previous flood of unconditional `scheduleVaultSync()` calls from every popup mount and `ENCRYPTED_VAULT_CACHE_UPDATED` listener — the root cause of quota errors on reloads — while preserving fast popup opens via the existing encrypted cache.

**Guiding principles** (align with AGENTS.md — **Security is the highest priority**):
- **Every change must pass the Mandatory Security Review Checklist** (Section 6 of AGENTS.md) before implementation. No exceptions for "convenience" or "better UX".
- Zero-knowledge is sacred: The server must never be able to decrypt anything. The DEK lives only in the client. Background service worker may hold a base64 DEK copy (for autofill readiness) but never performs crypto operations on user data itself.
- Prefer self-explanatory code + minimal comments.
- Small, focused PRs.
- **Strong UI/UX consistency with desktop**: The popup, options page, and any new dialogs/prompts (save credential, generator options, match selector) **must** use the same design system as the desktop app — Tailwind + shadcn/ui components, color tokens, typography, spacing, button/input variants, etc. (reference `desktop/src/components/ui/*`, `desktop/src/styles/`, and patterns in `VaultScreen.tsx`, `LoginPasswordField.tsx`, `PasswordGenerator*`).
- Reuse heavily from desktop + shared (password generator, crypto, types, patterns, and now UI components where feasible).
- Phased delivery per existing PROJECT_PLAN (extension depth in Phase 4), but front-load reliability + core daily flows.
- MV3-friendly: Use `chrome.scripting` for fills (isolated worlds where possible), minimize persistent background work. For injected content script UI (indicators, lightweight generator buttons, save prompts), use minimal custom HTML/CSS or shadow-DOM React with a slimmed design token subset to avoid bloating every page — while maintaining visual harmony with the desktop system.

**High-level target UX (MVP "fit for purpose")**:
- On login forms: "VL" indicator next to password (and associated username) fields.
- Click indicator → small inline dropdown or quick popup with best-matching logins for the current domain (filtered + ranked).
- One-click fill (username + password; handle React/SPA forms via proper events).
- On signup/submit forms with new creds: Prompt "Save to VaultLock?" (pre-filled, editable).
- Password field has "Generate" button (strength meter, options) that fills + offers to save.
- Popup remains excellent for search/browse/copy + manual unlock.
- Reliable: No quota crashes on reload; sync feels instant and predictable.
- Domain matching: Supports user-defined related domains per login item (e.g., `example.com` covers `login.example.com`, `app.example.com`).

**Security Posture (the most important filter)**
- Every design decision, permission request, and code change in this redesign must survive the full AGENTS.md Section 6 Mandatory Security Review Checklist.
- The background service worker will hold a DEK copy **only** for the minimum time required to support autofill (governed by the existing auto-lock + activity system). It will never perform decryption of vault items itself for autofill or save flows.
- All new flows (inline fill, save prompts, generator) will be reviewed for new side-channels, exfiltration risks from compromised pages, and proper zeroization.
- No new cryptographic primitives will be introduced.

**Tradeoffs accepted**:
- Slightly slower "first open" in some cases (acceptable for reliability win).
- Content script will grow in responsibility (but keep focused; split if it becomes unwieldy).
- More permissions (`scripting` at minimum; `contextMenus` later) — will require careful store review justification.

## Phased Implementation Plan

### Phase 0: Foundation & Reliability (Immediate — unblock dev & basic use)
- Fix persistent quota errors on extension reload (primary current blocker).
- Complete the existing "fill on click" skeleton to actually fill fields (one-click from popup list for a specific pending request).
- Move password generator to `@vaultlock/shared` (pure function + options type) so it can be used everywhere.
- Improve dev experience: Proper HMR guard or clear "use prod build for reload testing" docs + script.
- Clean any remaining over-commenting per updated AGENTS.md rule.

**Key changes**:
- `extension/src/lib/storage.ts`: Make migration truly one-time + bulletproof (durable "never touch sync again" flag even on partial failure; remove all remaining `.sync` code paths after successful migration).
- `extension/src/background.ts`: Reduce eager `performVaultSync` triggers; add stronger global fetch debounce; simplify cache warming logic.
- `extension/src/popup.tsx` + messaging: Wire actual fill execution for pending request (new "EXECUTE_FILL" message + content script handler using `document.getElementById` + event dispatch).
- `extension/src/contents/password-field-detector.ts`: Minor hardening + context for future fill.
- Dev scripts + README: HMR noise mitigation + testing guidance.

**Deliverable**: Extension no longer crashes with quota on reload; basic "click indicator → popup → select item → fields actually fill" works end-to-end on simple forms. All new popup/options UI uses desktop Tailwind + shadcn patterns for immediate consistency.

### Phase 1: Core Consumer Flows (Primary "fit for purpose" release)
- Inline password generator button next to password fields (injected by content script; reuses shared generator).
- Form submit detection + "Save this login?" prompt (new or enhanced content script logic listening for submits; pre-populate from detected fields + last typed values).
- Basic domain matching + filtering in popup and any inline UI (hostname match to start; prepare for related domains).
- Polish pending fill flow + add "Fill" action directly from vault list items when a pending request exists.
- Move more desktop patterns (e.g., display helpers) if useful.

**Key changes**:
- `extension/src/contents/password-field-detector.ts` (or new `autofill.ts` module): Generator injection + submit listeners + "SAVE_LOGIN" messaging.
- Background: Handlers for generate requests, save prompts (may involve opening popup with pre-filled data or inline dialog).
- Popup: Enhanced vault list with "Fill" buttons when context has pending request; basic URL matching/filter.
- Shared: `passwordGenerator.ts` moved + types.
- Possibly light new UI components for prompts (reuse desktop styling patterns where possible).

**Deliverable**: Daily driver flows work: autofill existing logins via indicator, generate strong passwords on forms, save new logins on submit. Reliable under normal use/reloads. Popup, save prompts, and generator settings UI fully follow desktop shadcn + Tailwind design system.

### Phase 2: Production-Quality Autofill (Full NordPass/LastPass parity for core use)
- Sophisticated matching: User-managed "related domains/URLs" per login item (schema extension or metadata on `LoginItemPlaintext`).
- Richer inline experience: Click indicator shows filtered list of matches (username previews, last used, etc.) without always forcing full popup.
- Context menus (`chrome.contextMenus`): "Fill with VaultLock", "Generate password here", "Save login".
- TOTP support (copy or fill if field detected).
- Better edge cases: Iframes, shadow DOM (limited), multi-step forms (leverage existing association logic), React-heavy sites (robust event simulation).
- Per-site settings ("Never autofill for this site", "Always ask before filling").
- Keyboard shortcuts + improved discoverability.

**Key changes**:
- Storage/types: Support for related domains on login items (or separate metadata table if needed).
- Content script + background: Full fill engine (secure scripting, matching engine in background or content, credential selection UI).
- New messages and state for save flows, matching results.
- Options page: Autofill settings.
- Permissions: `contextMenus`, possibly more scripting/tabs as needed (justify in manifest).

**Deliverable**: Extension feels like a mature commercial product for everyday web use.

### Phase 3+: Advanced & Polish (align with later PROJECT_PLAN)
- Biometric/quick unlock integration for the extension (WebAuthn PRF or platform authenticators) to unlock the vault without master password — already tracked in git issues and the biometric ADRs/plans. This would be a major UX win for autofill readiness and quick popup access, similar to desktop plans.
- Extension ↔ desktop handoff.
- Attachments, passkeys, etc. (if backend supports).
- Store publishing, analytics on permission prompts, A/B on matching, etc.

## Critical Files to Modify / Create

**Extension (primary work):**
- `extension/src/contents/password-field-detector.ts` (enhance heavily or split).
- `extension/src/background.ts` (simplify sync, add fill/save handlers, messaging).
- `extension/src/popup.tsx` (enhanced list, matching, fill/save UI).
- `extension/src/lib/messaging.ts` (proper typed messages for fill, save, generate).
- `extension/src/lib/storage.ts` (migration hardening + related domains support).
- `extension/src/lib/vaultSync.ts` + related (on-demand patterns).
- `extension/plasmo.config.ts` + `package.json` (permissions, content script updates).
- New: `extension/src/contents/autofill-filler.ts` or similar (actual DOM mutation + event logic — keep isolated). Injected UI (generator buttons, lightweight match lists) uses desktop design tokens via shadow DOM or slim CSS for consistency without pulling the full component library.
- `extension/src/options.tsx` (autofill settings later — full shadcn consistency with desktop).
- Dev: `extension/scripts/`, README.md (HMR guidance, testing matrix).

**Shared (high reuse value):**
- Move `desktop/src/lib/passwordGenerator.ts` → `shared/src/lib/passwordGenerator.ts` (or `crypto/`), export types/options.
- Possibly small helpers from desktop vault display logic.

**Other:**
- `docs/PROJECT_PLAN.md` (update phases/tickets with this detail).
- Possibly `shared/src/types/vault.ts` (related domains metadata on `LoginItemPlaintext` or new field).
- Backend: Minimal (if related domains need storage; current `url` field on login may suffice initially).

**Do not touch (or minimal):** Desktop app (reuse only), core crypto (already solid), backend vault endpoints (already support what we need).

## Existing Code & Patterns to Reuse (with Paths)
- **Field detection & association heuristics**: `extension/src/contents/password-field-detector.ts` (very good foundation — keep and extend).
- **DEK relay for autofill across popup lifetime**: `extension/src/lib/backgroundVaultSession.ts`, `vaultUnlockBridge.ts`, `vaultSession.ts` (already designed exactly for "background can fill without popup open").
- **Zero-knowledge patterns & crypto wrappers**: `extension/src/lib/vaultCrypto.ts`, desktop equivalents, `shared/src/crypto/`.
- **Vault item types & login data model**: `shared/src/types/vault.ts` (`LoginItemPlaintext` has `username`, `password`, `url`, `totp` — perfect).
- **Password generation logic + options**: `desktop/src/lib/passwordGenerator.ts` (move to shared; already uses Web Crypto, no deps).
- **Sync/merge logic & token handling** (adapt for on-demand): `desktop/src/lib/vaultItems.ts` (especially `maxSyncToken`, no-delta guards) + current extension guards (keep the rate limits we added).
- **Messaging safety**: `extension/src/lib/extensionRuntime.ts`.
- **Auto-lock / activity patterns**: Existing hooks and background timer (adapt for autofill "use" activity).
- **Desktop UI components & design system** (shadcn/ui + Tailwind): `desktop/src/components/ui/*`, `desktop/src/styles/modern-minimal.css` (and related), `PasswordGenerator*`, `LoginPasswordField.tsx`, `VaultScreen.tsx` patterns. Popup/options will import/share these directly. Content script injected UI will use a compatible token subset or shadow DOM for visual consistency without full bundle bloat.

## Verification Strategy (End-to-End)
1. **Reliability regression**:
   - Repeated extension reloads in dev + prod builds → no quota errors.
   - Multiple popup opens/closes + background worker terminations → DEK relay + cache still work.
   - Sync on slow networks / 400 errors → graceful fallback.

2. **Core UX flows (manual, on real sites)**:
   - GitHub, Google, a banking/demo site, SPA (React/Vue) login forms.
   - Indicator appears on password + username fields.
   - Click → see relevant matches (domain + related) → one-click fills both fields correctly (events dispatched).
   - Signup form: Generate button works, fills, submit triggers "Save?" prompt with pre-filled data.
   - Multi-step / associated fields: Correct pairing.
   - Locked state: Indicator click opens popup to unlock, then fill works.
   - TOTP fields: At minimum copy; ideally fill.
   - Matching accuracy with user-managed related domains.

3. **Edge cases**: Iframes (same-origin first), shadow DOM (best-effort), very long vaults (performance), many accounts per domain (good list UI), form variations (autocomplete attributes, dynamic fields).

4. **Dev experience**: `pnpm dev` + reloads produce minimal console noise; clear instructions in README for "testing autofill" (use prod build + unpacked).

5. **Security/permissions**: Review all new `chrome.scripting` calls (no eval of user data, minimal surface). Manifest updates justified. No plaintext leakage in SW.

6. **Metrics of success**: User can do 90% of daily password tasks without opening the full vault popup. No data loss on reloads. Matches or exceeds basic LastPass/NordPass flows for login/save/generate.
7. **Visual & interaction consistency**: Side-by-side comparison of popup/options/generator UI against desktop app (same buttons, inputs, colors, spacing, icons via lucide-react). Injected content script elements feel harmonious even if lighter.

**Testing strategy** (we will invest here from the start):
- **Unit tests** (Vitest, runnable in Node): All pure/reusable logic — `passwordGenerator`, domain/URL matching engine, `maxSyncToken` / merge logic, encryption roundtrips (using test vectors), message type guards, auto-lock timer logic, etc. These live in `shared/` and `extension/src/lib/` with `.test.ts` files.
- **Playwright E2E for browser flows** (primary automated safety net): Use Playwright's extension testing support (load unpacked dev/prod builds, grant permissions, interact with real pages). Cover:
  - Field detection + indicator injection on varied form types (plain HTML, React, multi-step, iframes where possible).
  - Full autofill roundtrip (indicator click → selection → actual field mutation + events).
  - Password generator injection + fill.
  - Form submit → save prompt flow (including editing before save).
  - Locked vs unlocked states, auto-lock, DEK relay across popup close/reopen.
  - Domain matching accuracy (exact, subdomain, user-managed related domains).
  - Sync behavior under simulated network conditions / 400s / reloads (no quota errors, correct token handling).
- **Manual exploratory + cross-browser matrix**: Chrome, Edge, Firefox (via the existing brave/firefox dev builds). Documented in a `docs/extension-testing.md`.
- **Mocks**: Backend can be stubbed or use the existing local dev server. Content script can be tested in isolation for pure helpers.
- **Deliverable per phase**: Phase 0 includes basic unit + 2-3 Playwright smoke flows. Each subsequent phase adds coverage for the new features.

This directly addresses the historical fragility (quota, races, token handling) with automated regression protection.

## Risks & Mitigations
- **Permission bloat / store rejection**: Request minimal set (`scripting`, `activeTab` initially; contextMenus later). Document user benefit clearly.
- **Form filling fragility across web**: Robust event simulation + fallback to basic `.value =`. Leverage existing detector's visibility heuristics.
- **Complexity creep in content script**: Keep one focused script; extract pure functions (matching, generate) to lib/shared.
- **Sync simplification introducing new races**: Addressed by the concrete strategy detailed in "Recommended Approach" above (background as sole sync engine + consumer-driven requests via messages + stale check + retained rate-limit guards). This is the primary mechanism to eliminate the previous unconditional trigger flood.
- **Timeline**: Align with PROJECT_PLAN Phase 4; deliver Phase 0+1 as "MVP fit for purpose" sooner.
- **Security review (highest priority risk)**: Every new or modified code path (especially anything using `chrome.scripting` for filling, any new message handlers, DEK lifetime in the service worker, save prompt flows, or permission changes) **must** be reviewed against the full AGENTS.md Section 6 checklist before merging. Explicit focus areas for this project:
  - No expansion of what the background worker can decrypt or log.
  - Careful use of `chrome.scripting.executeScript` (prefer isolated world, never execute user-controlled strings).
  - Clear justification and minimal scope for any new permissions (`scripting`, `contextMenus`, etc.).
  - Autofill must not create new ways for a compromised page to exfiltrate vault data.
  - Formal lightweight threat model for the new flows (page compromise, malicious extension, service worker compromise, etc.) will be documented as part of Phase 0/1.

## Open Questions / Next Discussion Points
- Exact UI for "inline dropdown vs mini popup" on indicator click (component complexity trade-off).
- When to surface "Save?" prompt (on submit, on password field blur after username, etc.).
- How to store "related domains" (extend `LoginItemPlaintext.url` to array? Separate metadata?).
- Rollout: Beta channel or direct to users?
- Any specific sites or competitors' behaviors as "must match exactly"?

This plan provides a concrete, phased path forward that addresses both the immediate "not fit for purpose" gaps and the architectural debt causing reliability issues. It reuses as much as possible and respects the project's zero-knowledge and monorepo principles.

Ready for review and iteration with the team.
