# ADR 0004: Multi-Device DEK Sharing (One wrapped_dek per user)

**Status:** Accepted  
**Date:** 2026-06-01  
**Deciders:** Engineering team (owner + agent discussion)  
**Related:** Epic #189 (Browser Extension Redesign), AGENTS.md §6

## Context

The browser extension redesign (and overall multi-client strategy) requires users to access the same vault across desktop, extension, and future mobile clients.

Currently, each client generates its own independent random DEK on first unlock for an account (when no local wrapped_dek record exists). This means items created on one device are not decryptable on another.

The server must never learn the DEK or master key (zero-knowledge requirement).

## Decision

We will support **one `wrapped_dek` per user** (a single account-level DEK, wrapped with the user's master key derived from password + email).

- The wrapped value is stored on the server (users.wrapped_dek column).
- It is returned on every successful /login response.
- First device uploads it after generating the DEK.
- Subsequent devices download it after login and unwrap locally.

If a user record ever has vault items but no `wrapped_dek`, the items are considered orphaned and will be deleted.

The desktop app will be updated to follow the identical flow.

## Consequences

**Positive:**
- Simple, auditable design that matches standard consumer zero-knowledge vault patterns.
- All devices see the exact same data with minimal complexity.
- Server only stores ciphertext it cannot decrypt.

**Negative / Risks:**
- DEK rotation becomes a heavy all-or-nothing operation.
- Compromise of the DEK on any unlocked device compromises the entire vault until rotation.
- Requires careful client implementation to avoid creating multiple DEKs during the transition.

**Alternatives Considered:**
- Multiple wrapped_dek records (per-device or key slots): Rejected for v1 due to massive increase in crypto and sync complexity. Can be revisited later if compartmentalization or granular revocation becomes a requirement.

## Implementation Notes

- Backend migration + User model update + return in login response + save endpoint.
- Clients must:
  - Upload wrapped_dek on first successful unlock when none existed locally.
  - Use the one from login when local is missing.
  - Handle the orphan-items-delete case.
- Full AGENTS §6 security review required for all changes touching key material.
- Diagram and detailed flow live in `docs/plans/browser-extension-redesign-2026.md`.

## References

- Epic #189
- `docs/plans/browser-extension-redesign-2026.md` (Multi-Device DEK Sharing section)
- AGENTS.md §6 (Mandatory Security Review Checklist)
