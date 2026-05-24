# Vaultlock

**Secure. Simple. Yours.**

A self-hosted, zero-knowledge, end-to-end encrypted password manager and secure notes vault.

Stop paying subscriptions — take full control of your data.

## Features (MVP)

- Passwords, secure notes, and TOTP
- Zero-knowledge E2EE (Argon2id + AES-256-GCM)
- Desktop biometric quick unlock (Touch ID / Windows Hello) with auto-lock and master-password re-auth
- Strong password generator
- Browser extension (autofill)
- Desktop app (Tauri)
- Mobile app (React Native)
- Easy self-hosting with Docker Compose

## Local Development

See **[Development Environment](./docs/DEV_ENVIRONMENT.md)** for full setup (backend, database, desktop app, and platform prerequisites).

### Quick Start

```bash
git clone https://github.com/scott-harrison/vaultlock.git
cd vaultlock
pnpm install
cp .env.example .env

# Database + API
docker compose up postgres -d
cd backend && cargo run

# Desktop app (separate terminal, from repo root)
pnpm desktop:dev
```

Backend health check: `curl http://localhost:8080/health`

## Project Structure

See [ADR-0001: Monorepo Layout](./docs/adr/0001-monorepo-layout.md)

## Testing Standards

See [TESTING.md](./TESTING.md)

## Self Hosting

See [SELF_HOSTING.md](./docs/SELF_HOSTING.md)

## Security (biometric quick unlock)

See [BIOMETRIC_QUICK_UNLOCK.md](./docs/BIOMETRIC_QUICK_UNLOCK.md) for how Touch ID / Windows Hello quick unlock works on desktop.

## Architecture Decision Records

- [ADR-0001: Monorepo Layout](./docs/adr/0001-monorepo-layout.md)
- [ADR-0002: Mobile Distribution Strategy](./docs/adr/0002-mobile-distribution-strategy.md)
- [ADR-0003: Biometric Quick Unlock](./docs/adr/0003-biometric-quick-unlock.md)

## License

MIT
