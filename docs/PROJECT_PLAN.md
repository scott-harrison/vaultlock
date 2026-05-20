# Vaultlock - Project Plan

**Project Name:** Vaultlock  
**Tagline:** Secure. Simple. Yours.  
**Type:** Self-hosted, end-to-end encrypted password + secure notes manager  
**Goal:** Replace paid services (1Password, NordPass, LastPass) with a free, private, self-hosted solution.

---

## 1. Project Overview

Vaultlock is a modern, zero-knowledge, end-to-end encrypted password manager + secure notes app designed for self-hosting. Users maintain full control of their data with client-side encryption. The server never sees plaintext passwords, notes, or encryption keys.

**Core Principles**
- Zero-knowledge architecture (server is cryptographically blind)
- Easy self-hosting (Docker + one-command deploy)
- Beautiful, professional, serious UI (no cute elements)
- Cross-platform access (Desktop + Browser Extension + Mobile — **no standalone web app**)

---

## 2. Goals & Success Criteria

**Primary Goals**
- Deliver a production-ready, auditable E2EE vault
- Make self-hosting as easy as possible
- Achieve feature parity with basic paid password managers within 6 months

**Success Metrics (MVP)**
- Users can create accounts, store logins + secure notes
- Full client-side encryption (AES-256-GCM + Argon2id)
- Works offline with encrypted local cache
- Clean, professional UI matching approved branding
- One-command Docker self-host deployment

---

## 3. Core Features

### MVP (Phase 1–2)
- User registration & login (master password) — **backend done**
- **Desktop app (Tauri)** — primary client for vault CRUD
- Vault: Logins (URL, username, password, TOTP, notes)
- Secure Notes (Markdown support)
- Password generator (strong, customizable)
- Full CRUD with sync (encrypted API done)
- Client-side encryption + decryption
- Basic browser extension (copy to clipboard) — after desktop MVP

### Phase 3+
- Full browser extension with autofill
- Search, favorites, folders/tags
- Export (encrypted JSON)
- Mobile apps (React Native with Expo) — **last client**
- Attachments (encrypted)
- Passkey support
- Biometric quick unlock (see [plans/secure-biometric-unlock.md](plans/secure-biometric-unlock.md))
- Master password change (without re-encrypting everything)

### Future / Nice-to-Have
- Secure sharing (public-key crypto)
- Organization / family sharing
- Breach monitoring (client-side Have I Been Pwned)
- Audit log
- Dark web monitoring integration

---

## 4. Security Architecture (Zero-Knowledge)

**Key Components**
- **Key Derivation**: Argon2id (high memory, 3–4 iterations)
- **Encryption**: AES-256-GCM (authenticated)
- **Master Key**: Derived from user’s master password + email
- **Data Encryption Key (DEK)**: Random per user, wrapped by Master Key
- **Authentication**: Separate login hash (never reuse master password)
- **Transport**: TLS 1.3 only

**Important Rules**
- Server stores only ciphertext + metadata
- All encryption/decryption happens on the **client** (desktop, extension, or mobile)
- Master password never leaves the device
- No password recovery (by design)

---

## 5. Tech Stack

| Layer          | Technology                          | Reason |
|----------------|-------------------------------------|--------|
| **Client UI**  | React + Tailwind + shadcn/ui (inside Tauri / extension / RN) | Shared patterns; **no standalone web app** |
| **Backend**    | Rust (Axum) + SQLx + PostgreSQL    | Security, performance, memory safety |
| **Crypto**     | `ring` + `argon2` crates           | Audited, battle-tested |
| **Database**   | PostgreSQL                         | Reliable, scalable |
| **Auth**       | JWT + refresh tokens               | Standard, secure |
| **Deployment** | Docker + Docker Compose + Caddy    | Easy self-hosting |
| **Desktop**    | Tauri (Rust + embedded React UI)   | Primary vault UI — Windows + macOS (**first client**) |
| **Extension**  | Manifest V3 + Plasmo               | Autofill + quick access (**second client**) |
| **Mobile**     | React Native (with Expo)           | iOS + Android (**third client**) |

---

## 6. System Architecture

```
[Desktop (Tauri) / Extension / Mobile]
          ↓ HTTPS (TLS 1.3)
[Reverse Proxy (Caddy)]
          ↓
[Backend API (Rust/Axum)]
  - Auth (login/register)
  - Sync (encrypted vault)
          ↓
[PostgreSQL]
  - users (email, auth_hash, kdf_params, wrapped_dek)
  - vault_items (encrypted blobs)
```

---

## 7. Development Roadmap

### Phase 1: Foundation (Weeks 1–4)
- Project setup + monorepo
- Backend skeleton (Rust + Axum + PostgreSQL)
- Basic user auth + Argon2id KDF
- Client-side crypto module (key derivation + AES-GCM)
- Encrypted vault CRUD API + sync
- Docker Compose for local development

**Tickets:** ~12–15 (backend complete; client work starts Phase 2)

### Phase 2: Core Vault — Clients (Weeks 5–12)

**Client priority:** Desktop → Extension → Mobile (no standalone web app)

1. **Desktop app (Tauri)** — Windows + macOS primary vault UI: register/login, unlock, list/add/edit/delete, sync with backend
2. **Browser extension (Plasmo)** — popup vault, password-field detection, copy/autofill basics
3. **Mobile (Expo)** — iOS + Android vault (after desktop + extension patterns are proven)

Also in this phase:
- Password generator (in desktop first, then extension/mobile)
- Search + folders/tags
- Offline support (encrypted local cache)
- Export/import

**Tickets:** ~18–22

### Phase 3: Polish & Self-Host (Weeks 13–15)
- Professional UI matching final branding (desktop + extension)
- Production Docker Compose (with Caddy + HTTPS)
- Documentation & one-click deploy scripts
- Security hardening + expanded client tests

**Tickets:** ~10–12

### Phase 4: Extension depth (Weeks 16–19)
- Full autofill flows
- Context menu + permissions hardening
- Extension ↔ desktop handoff (shared auth where applicable)

**Tickets:** ~10–15

### Phase 5: Mobile + later
- React Native mobile apps (iOS + Android)
- Attachments (encrypted)
- Passkey support
- Master password change (without re-encrypting everything)

---

## 8. Suggested Ticket Structure (for GitHub / Linear)

Use these labels:
- `phase-1`, `phase-2`, `phase-3`, etc.
- `frontend`, `backend`, `crypto`, `security`, `devops`, `docs`

**Example Tickets**
- [x] Set up monorepo + Rust backend skeleton
- [x] Implement Argon2id key derivation (client + server)
- [x] Build AES-256-GCM encryption/decryption module
- [x] Create user registration + login flow
- [x] Build encrypted vault CRUD API
- [ ] Build Tauri desktop app (Windows + macOS) — **primary client**
- [ ] Add password generator component (desktop first)
- [ ] Build browser extension skeleton — **after desktop**
- [ ] Create production Docker Compose (Caddy + PostgreSQL)
- [ ] Write self-hosting documentation
- [ ] Mobile app (Expo) — **last client**

---

## 9. Risks & Mitigations

| Risk                        | Mitigation |
|----------------------------|----------|
| Crypto implementation bugs | Use audited crates (`ring`, `argon2`), extensive tests, peer review |
| Autofill complexity        | Start with copy-to-clipboard, add full autofill later |
| Self-hosting friction      | Provide excellent Docker Compose + one-click scripts + clear docs |
| Performance on large vaults| Lazy decryption + indexed search on encrypted metadata |
| User forgets master password | Strong onboarding + encrypted export feature |

---

## 10. Self-Hosting (Production)

**Recommended Stack**
- Docker + Docker Compose
- Caddy (automatic HTTPS)
- PostgreSQL
- Fail2Ban (optional but recommended)
- Admin token protection

**One-command goal**: `docker compose up -d` → fully working instance.

---

## 11. Branding Reference

**Final Logo**: Use the approved version (white V+L monogram with teal accent on dark background + "VAULTLOCK" wordmark).

**Colors** (Midnight Security):
- Deep Charcoal: `#0F172A`
- Steel Blue: `#1E40AF`
- Ice White: `#F1F5F9`
- Cool Gray: `#475569`

---

## 12. Next Steps

1. **Backend foundation** — DONE (issues #1–#5 merged to `main`)
2. **Close web vault scope** — issue #6 cancelled; clients-only strategy
3. **Create desktop (Tauri) epic** — first client: register, unlock, vault CRUD, sync
4. **Extension** (#10) — after desktop MVP
5. **Mobile** — after extension
6. **Self-host** (#8, #9) — production Docker + docs (can parallelize with desktop)

---

**Document Version**: 1.1  
**Last Updated**: May 2026  
**Status**: Backend MVP complete; starting desktop client

---

*This plan is designed to be broken into small, actionable tickets. Let me know if you want me to expand any section or generate the first batch of tickets.*