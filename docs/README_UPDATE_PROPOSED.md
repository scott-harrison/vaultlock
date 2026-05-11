# VaultLock

**Secure, portable credential & identity vault for AI agents and automation workflows.**

VaultLock provides an encrypted, cross-machine portable vault for storing and injecting credentials (OAuth tokens, API keys, PATs) per agent instance — with full auditability and crash-safe operations.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker + Docker Compose
- Rust (latest stable) + Cargo
- Node.js 20+ + pnpm (or npm)
- PostgreSQL (via Docker)

### 1. Clone & Setup
```bash
git clone https://github.com/scott-harrison/vaultlock.git
cd vaultlock
```

### 2. Start Backend + Database
```bash
docker compose up --build
```

This starts:
- Rust Axum backend on `http://localhost:8080`
- PostgreSQL on `localhost:5432`

Health check: `curl http://localhost:8080/health`

### 3. Run Frontend (separate terminal)
```bash
cd frontend
pnpm install
pnpm dev
```

### 4. Run Tests
```bash
# Backend (Rust)
cargo test --workspace

# Frontend
cd frontend
pnpm test

# Full CI simulation
cargo clippy --workspace -- -D warnings
cargo fmt -- --check
```

---

## 📁 Monorepo Structure

```
vaultlock/
├── backend/          # Rust (Axum + SQLx + PostgreSQL)
├── frontend/         # React + TypeScript
├── mobile/           # React Native
├── extension/        # Browser extension
├── shared/           # Common types + crypto primitives
├── docs/             # ADRs, API specs, Bruno collections
│   ├── adr/
│   │   └── 0001-monorepo-layout.md
│   └── api/bruno/
├── TESTING.md        # Testing standards & coverage requirements
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔐 Key Features (Planned)

- Encrypted portable vault (AES-256-GCM + Argon2id)
- Per-instance credential injection
- OAuth flows (Google, GitHub, Anthropic, OpenAI, AWS, Kimi)
- Crash-safe WAL + file locking
- Full audit log & identity registry

---

## 📖 Documentation

- **Architecture Decision Records (ADRs):** [docs/adr/0001-monorepo-layout.md](docs/adr/0001-monorepo-layout.md)
- **Testing Standards:** [TESTING.md](TESTING.md)
- **API Collections:** `docs/api/bruno/` (Bruno)

---

## 🚢 Contributing

All changes go through **Pull Requests** to `main`.

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make small, focused changes
3. Ensure all CI checks pass (tests ≥ 85% coverage, clippy, biome, fmt)
4. Open a PR with clear description referencing the issue

See [TESTING.md](TESTING.md) for coverage and quality gates.

---

## 🔧 Tech Stack

- **Backend:** Rust, Axum, SQLx, PostgreSQL
- **Frontend:** React, TypeScript, Biome
- **Mobile:** React Native
- **Extension:** WebExtension
- **Security:** AES-256-GCM, Argon2id, Zeroize

---

**Status:** Phase 1 (Monorepo + Backend Skeleton) — **Complete**

---

*Built with engineering excellence. Protected `main` branch. Small PRs only.*