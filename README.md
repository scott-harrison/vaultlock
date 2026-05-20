# Vaultlock

**Secure. Simple. Yours.**

A self-hosted, zero-knowledge, end-to-end encrypted password manager and secure notes vault.

Stop paying subscriptions — take full control of your data.

## Features (MVP)

- Passwords, secure notes, and TOTP
- Zero-knowledge E2EE (Argon2id + AES-256-GCM)
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

See [SELF_HOSTING.md](./SELF_HOSTING.md)

## Architecture Decision Records

- [ADR-0001: Monorepo Layout](./docs/adr/0001-monorepo-layout.md)

## License

MIT
