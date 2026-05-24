# ADR-0003: Biometric Quick Unlock

**Status:** Accepted  
**Date:** 2026-05-23  
**Deciders:** Project Manager & Lead Architect  
**Related Issues:** #77 (Biometric quick unlock epic), #136 (16-01), #138 (16-03), #139 (16-04)

---

## Context

Vaultlock uses a zero-knowledge model: the server never receives the master password or plaintext vault data. After sign-in, the desktop client derives a master key (Argon2id), unwraps a locally stored data encryption key (DEK), and keeps the DEK in memory while the vault is unlocked.

Users expect optional **biometric quick unlock** (Touch ID, Face ID, Windows Hello) as a convenience layer when the vault is locked but the device is otherwise in use. This must not weaken the primary trust model: the master password remains the root of trust for account access and key recovery.

Full design background: [secure-biometric-unlock.md](../plans/secure-biometric-unlock.md).

---

## Decision

Implement **optional, client-local biometric quick unlock** with these rules:

1. **Separate random key** — Generate a 32-byte `biometric_unlock_key` when the user opts in. Never derive vault keys from biometric templates.
2. **Wrap DEK only** — Encrypt the in-memory DEK with AES-256-GCM using `biometric_unlock_key`, persist the ciphertext envelope locally (`vault-keys.json` via Tauri store).
3. **OS secure storage for the wrap key** — Store `biometric_unlock_key` in platform secure storage (macOS Keychain, Windows Hello–protected credential store) via `tauri-plugin-biometry`, gated by biometric or device PIN on each retrieval.
4. **Master password always available** — Unlock screen always offers master password. Biometric button appears only when enrolled, hardware is available, and periodic re-auth is not due.
5. **Opt-in after full unlock** — Enrollment runs from **Settings → Security** only while the vault is unlocked with the master password.
6. **Server stays out of the loop** — No biometric data, wrap keys, or DEK envelopes on the server. JWT refresh after biometric unlock uses the existing session credentials already stored on the device.
7. **Configurable auto-lock and re-auth** — Defaults: auto-lock after **5 minutes** idle; require master password at least every **7 days** even when biometrics succeed.

### Platform scope (as of this ADR)

| Client | Status |
|--------|--------|
| **Desktop (Tauri)** | **Shipped** — Touch ID / Face ID (macOS), Windows Hello |
| Browser extension | Planned — WebAuthn PRF (#137) |
| Mobile (Expo) | Planned |
| Phone approves desktop | Deferred — Phase 2 device pairing |

### Invalidation (desktop, current behavior)

| Event | Effect |
|-------|--------|
| User disables quick unlock in settings | Removes keychain entry and local envelope |
| Sign out | Clears biometric enrollment for that account |
| Server URL change | Clears biometric enrollment and local auth/vault data |
| Lock / auto-lock | Clears in-memory DEK only; enrollment persists |
| Master password change | **Planned** — invalidate quick unlock everywhere (not yet wired) |

---

## Rationale

| Alternative | Why rejected |
|-------------|--------------|
| Derive DEK from biometric template | Biometrics are not secrets; templates change; unsuitable as KDF input |
| Replace master password with biometrics | No recovery path; weak against offline attacks; violates zero-knowledge onboarding |
| Store DEK in plaintext locally | Trivial theft if device is accessed while locked at OS level |
| Server-side “quick unlock” flag with shared secret | Breaks zero-knowledge; expands attack surface |

Biometric quick unlock protects against **casual access** (someone picks up an unlocked laptop session). It does **not** protect against malware in the unlocked process, compromised OS, or an attacker who knows the master password.

---

## Implementation notes (desktop)

- **Plugin:** `@choochmeque/tauri-plugin-biometry-api` with macOS entitlements (`Entitlements.plist`, `Info.plist`).
- **Stores:** `vault-keys.json` (DEK envelope), `settings.json` (auto-lock, re-auth, last master-password unlock timestamp).
- **macOS dev builds:** Unsigned debug binaries cannot use the data-protection keychain reliably. Dev builds fall back to `biometric-dev-fallback.json` after a keychain error, still requiring a biometric prompt via `authenticate()`. Production/release builds use the system keychain. Dev runner: `desktop/scripts/macos-dev-runner.sh` (ad-hoc codesign before launch).
- **Linux:** Biometric availability depends on the plugin and OS; when unavailable, the UI shows master-password-only unlock with no insecure fallback.

User-facing guide: [BIOMETRIC_QUICK_UNLOCK.md](../BIOMETRIC_QUICK_UNLOCK.md).

---

## Consequences

**Positive:**

- Faster re-entry after auto-lock without retyping the master password
- Clear separation between account trust (master password + server auth) and device convenience (local wrap key)
- Self-hosters require no server configuration for biometrics

**Negative / risks:**

- Extension and mobile parity still outstanding; users may expect biometrics everywhere
- Dev fallback storage is weaker than production keychain — documented for contributors only
- Envelope + keychain entry on disk still require OS full-disk encryption and screen lock for defense in depth

---

## References

- [BIOMETRIC_QUICK_UNLOCK.md](../BIOMETRIC_QUICK_UNLOCK.md) — user guide
- [secure-biometric-unlock.md](../plans/secure-biometric-unlock.md) — full design and future work
- `desktop/src/lib/biometricVaultUnlock.ts`, `biometricUnlock.ts`, `securitySettings.ts`
