# ADR-0002: Mobile App Distribution Strategy (Hybrid Approach)

**Status:** Accepted  
**Date:** 2026-05-13  
**Deciders:** Project Manager & Lead Architect  
**Related Issues:** #1 (Monorepo + backend skeleton), Mobile distribution discussion

---

## Context

Vaultlock is a self-hosted, zero-knowledge password manager. Users expect a straightforward mobile experience when self-hosting their own instance.

The React Native mobile app (Expo) must support connecting to arbitrary self-hosted backends. Publishing to Apple App Store and Google Play requires managing sensitive signing credentials, API keys, and provisioning profiles.

Storing these credentials in the main monorepo CI pipeline creates unacceptable security risk and operational burden.

## Decision

Adopt a **hybrid distribution strategy**:

- Keep the full React Native source code in the **public monorepo** (`mobile/`) for maximum code sharing, auditability, and contributor accessibility.
- Create a **lightweight, isolated distribution layer** (EAS Build configuration + GitHub Actions) responsible for:
  - Building signed APKs/IPAs for self-hosters (via EAS Build)
  - Official store publishing (one-time setup with strict credential isolation)
  - Providing clear "Build Your Own App" documentation
- The mobile app will support **runtime server URL configuration** (first-launch flow or settings screen).

## Rationale

- **Security**: Store signing credentials are high-value targets. Isolating them in a dedicated distribution layer (or separate repo) significantly reduces blast radius.
- **Self-hosting UX**: Users can either:
  1. Download the official app from stores and simply enter their self-hosted URL (easiest path), or
  2. Build a custom version via EAS Build in minutes (maximum privacy path).
- **Code Quality**: Full source remains in monorepo → shared crypto (Argon2id/AES), types, components, and testing standards.
- **Maintainability**: Clear separation of concerns between "app logic" and "distribution/publishing".

## Alternatives Considered

**A. Single monorepo + direct store publishing**
- Pros: Simplest initial setup
- Cons: High credential risk, ongoing DevOps burden, potential for accidental exposure
- Rejected: Unacceptable security posture for a password manager

**C. Fully separate mobile repository**
- Pros: Maximum isolation
- Cons: Loses code sharing benefits, duplicate CI/maintenance, harder to keep crypto implementations in sync, reduced auditability
- Rejected: Sacrifices too much of the monorepo value

## Consequences

**Positive:**
- Excellent long-term security posture
- Self-hosting remains straightforward (no forced store publishing for users)
- Strong code sharing and auditability
- Clear documentation path for both "easy" and "maximum privacy" users

**Negative / Risks:**
- Slightly more complex initial distribution setup (EAS + GitHub Actions)
- Requires one-time store publishing effort (we accept this as part of being a serious product)

## Implementation Notes

- Runtime server URL support will be implemented as part of the mobile auth flow (Issue #2 prerequisite).
- EAS Build profile "self-hosted" will be added for easy custom builds.
- Official store app (if published) will default to a demo server but allow easy switching.
- Documentation will live in `SELF_HOSTING.md` and a new `docs/mobile/BUILD-YOUR-OWN.md`.

---

*This ADR supersedes earlier informal discussions. Any future changes require a new ADR or PR with security reviewer approval.*