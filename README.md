# Vaultlock

**Secure. Simple. Yours.**

A self-hosted, zero-knowledge, end-to-end encrypted password and secure notes manager.

Take full control of your digital life — no subscriptions, no vendor lock-in, no data leaks.

## Features

- **Passwords, Cards, Identities & Secure Notes**: Full vault with rich Markdown notes support.
- **Zero-Knowledge Encryption**: Client-side only (Argon2id + AES-256-GCM). Server sees nothing.
- **Password Generator**: Strong, entropy-aware generator with custom rules.
- **TOTP & Passkeys**: Built-in authenticator and WebAuthn support.
- **Browser Extension**: Autofill, context menu, and secure clipboard.
- **Desktop App**: Native Tauri application (macOS, Windows, Linux).
- **Mobile Apps**: React Native (iOS & Android) with Expo.
- **Self-Hosted**: One-command Docker Compose deploy with Caddy for HTTPS.
- **Future**: Encrypted sharing, family organizations, breach monitoring.

## Quick Start (Self-Host)

```bash
git clone https://github.com/scott-harrison/vaultlock.git
cd vaultlock
docker compose up -d
```

Open http://localhost:8080 (configure your domain in .env for production).

## Tech Stack

| Layer      | Technology                          | Notes                          |
|------------|-------------------------------------|--------------------------------|
| Frontend   | React (Next.js or Vite) + Tailwind + shadcn/ui | Modern, accessible UI         |
| Backend    | Rust (Axum) + SQLx + PostgreSQL    | High performance, safe         |
| Crypto     | Argon2id, AES-256-GCM              | Audited primitives             |
| Desktop    | Tauri                              | Lightweight native shell       |
| Mobile     | React Native (Expo)                | Cross-platform native          |
| Extension  | Plasmo (Manifest V3)               | Seamless browser integration   |
| Hosting    | Docker + Caddy                     | Automatic HTTPS & reverse proxy|

## Architecture

See the full system diagram and zero-knowledge flow in [PROJECT_PLAN.md](./PROJECT_PLAN.md).

## Roadmap & Tickets

This project follows a structured 5-phase roadmap:

- **Phase 1 (Foundation)**: Monorepo, backend skeleton, crypto core, basic web vault, Docker setup (~12-15 tickets)
- **Phase 2 (Core Vault)**: Full CRUD, search, sync, offline support, export (~18-22 tickets)
- **Phase 3 (Polish & Self-Host)**: Production UI, admin panel, docs, security hardening (~10-12 tickets)
- **Phase 4 (Browser Extension)**: Autofill, permissions, context actions (~15-18 tickets)
- **Phase 5 (Desktop + Mobile)**: Tauri app, React Native builds (later)

All work is tracked via GitHub Issues with labels (`phase-1`, `backend`, `frontend`, `crypto`, `security`, `devops`, `docs`).

**Current Focus**: Phase 1 tickets are being created now.

## Contributing

1. Read [PROJECT_PLAN.md](./PROJECT_PLAN.md) for ticket structure and acceptance criteria.
2. Pick an open issue labeled with the current phase.
3. Follow conventional commits and Rust/React best practices.
4. All crypto-related changes require extra review.

## Security

This is a high-security project. Please report vulnerabilities responsibly via GitHub Security Advisories.

## License

MIT License — see LICENSE file (to be added).

---

Built with ❤️ for privacy-conscious users. Star the repo if you believe in open-source secure tools!