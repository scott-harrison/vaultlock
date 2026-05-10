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
- Cross-platform access (Web + Browser Extension + Desktop + Mobile later)

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

### MVP (Phase 1)
- User registration & login (master password)
- Vault: Logins (URL, username, password, TOTP, notes)
- Secure Notes (Markdown support)
- Password generator (strong, customizable)
- Search, favorites, folders/tags
- Full CRUD with sync
- Client-side encryption + decryption
- Export (encrypted JSON)
- Basic browser extension (copy to clipboard)

### Phase 2
- Full browser extension with autofill
- Desktop app (Tauri)
- Attachments (encrypted)
- Passkey support
- Master password change (without re-encrypting everything)
- Mobile apps (React Native with Expo)

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
- All encryption/decryption happens in the browser
- Master password never leaves the device
- No password recovery (by design)

---

## 5. Tech Stack

| Layer          | Technology                          | Reason |
|----------------|-------------------------------------|--------|
| **Frontend**   | React (Next.js or Vite) + Tailwind + shadcn/ui | Excellent ecosystem, great DX, shadcn works perfectly |
| **Backend**    | Rust (Axum) + SQLx + PostgreSQL    | Security, performance, memory safety |
| **Crypto**     | `ring` + `argon2` crates           | Audited, battle-tested |
| **Database**   | PostgreSQL                         | Reliable, scalable |
| **Auth**       | JWT + refresh tokens               | Standard, secure |
| **Deployment** | Docker + Docker Compose + Caddy    | Easy self-hosting |
| **Desktop**    | Tauri (Rust + Web frontend)        | Native feel, small size |
| **Mobile**     | React Native (with Expo)           | Cross-platform iOS + Android, fast development |
| **Extension**  | Manifest V3 + Plasmo               | Modern browser extension |

---

## 6. System Architecture

```
[Browser / Extension / Tauri App]
          ↓ HTTPS (TLS 1.3)
[Reverse Proxy (Caddy)]
          ↓
[Backend API (Rust/Axum)]
  - Auth (login/register)
  - Sync (encrypted vault)
  - Admin panel (protected)
          ↓
[PostgreSQL]
  - users (email, auth_hash, kdf_params, wrapped_dek)
  - ciphers (encrypted blobs)
```

---

## 7. Development Roadmap

### Phase 1: Foundation (Weeks 1–4)
- Project setup + monorepo
- Backend skeleton (Rust + Axum + PostgreSQL)
- Basic user auth + Argon2id KDF
- Client-side crypto module (key derivation + AES-GCM)
- Simple web vault (React + Vite or Next.js)
- Docker Compose for local development

**Tickets:** ~12–15

### Phase 2: Core Vault (Weeks 5–9)
- Encrypted item CRUD (logins + notes)
- Password generator
- Search + folders/tags
- Sync between devices
- Offline support (encrypted local cache)
- Export/import

**Tickets:** ~18–22

### Phase 3: Polish & Self-Host (Weeks 10–12)
- Professional UI matching final branding
- Production Docker Compose (with Caddy + HTTPS)
- Admin panel
- Documentation & one-click deploy scripts
- Security hardening + basic tests

**Tickets:** ~10–12

### Phase 4: Browser Extension (Weeks 13–17)
- Manifest V3 extension
- Popup vault
- Context menu + autofill (basic)
- Permissions handling

**Tickets:** ~15–18

### Phase 5: Desktop + Mobile (Later)
- Tauri desktop app
- React Native mobile apps (iOS + Android) using Expo

---

## 8. Suggested Ticket Structure (for GitHub / Linear)

Use these labels:
- `phase-1`, `phase-2`, `phase-3`, etc.
- `frontend`, `backend`, `crypto`, `security`, `devops`, `docs`

**Example Tickets**
- [ ] Set up monorepo + Rust backend skeleton
- [ ] Implement Argon2id key derivation (client + server)
- [ ] Build AES-256-GCM encryption/decryption module
- [ ] Create user registration + login flow
- [ ] Build encrypted vault CRUD API
- [ ] Implement React web vault UI (Next.js or Vite + shadcn)
- [ ] Add password generator component
- [ ] Create production Docker Compose (Caddy + PostgreSQL)
- [ ] Write self-hosting documentation
- [ ] Build browser extension skeleton

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

1. **Create GitHub repository** named `vaultlock` — DONE
2. Set up project board with the phases above
3. Create first 10–15 tickets from Phase 1
4. Begin development (backend skeleton + crypto module first)

---

**Document Version**: 1.0  
**Last Updated**: May 2026  
**Status**: Ready to start development

---

*This plan is designed to be broken into small, actionable tickets. Let me know if you want me to expand any section or generate the first batch of tickets.*