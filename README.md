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

### Prerequisites

#### 1. Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify:
```bash
rustc --version
cargo --version
```

#### 2. pnpm
```bash
npm install -g pnpm
```

#### 3. Docker + Docker Compose

### Quick Start

```bash
# Clone repo
git clone https://github.com/scott-harrison/vaultlock.git
cd vaultlock

# Install dependencies
pnpm install

# Start development environment
docker compose up --build
```

Backend will be available at `http://localhost:8080`.

### Development Commands

```bash
# Format code (Biome + Rust)
pnpm format

# Lint code
pnpm lint

# Run backend tests
pnpm test
```

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
