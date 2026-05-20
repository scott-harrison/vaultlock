# Development Environment

This guide gets you from a fresh clone to a running **backend API** and **Tauri desktop app** on macOS or Windows.

## Overview

| Component | Location | How you run it |
|-----------|----------|----------------|
| PostgreSQL | Docker | `docker compose up postgres -d` |
| Backend API | `backend/` | `cargo run` (loads `.env` from repo root) |
| Shared library | `shared/` | Consumed by clients; tested with Vitest |
| Desktop app | `desktop/` | `pnpm tauri dev` (native window) |

The backend listens on **http://localhost:8080**. The desktop app is configured to talk to that URL in later sub-tasks (#11-02); for **11-01** you only need the window to open.

---

## Prerequisites

Install these once on your machine.

### All platforms

| Tool | Version | Install |
|------|---------|---------|
| **Git** | latest | [git-scm.com](https://git-scm.com/) |
| **Node.js** | 22 LTS | [nodejs.org](https://nodejs.org/) or `nvm install 22` |
| **pnpm** | 11.x | `npm install -g pnpm@11` |
| **Rust** | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Docker** | latest | [docker.com](https://www.docker.com/products/docker-desktop/) |

Verify:

```bash
node --version    # v22.x
pnpm --version    # 11.x
rustc --version
cargo --version
docker --version
```

### macOS (Tauri desktop)

1. **Xcode Command Line Tools** (compiler + SDK):

   ```bash
   xcode-select --install
   ```

2. No extra WebView runtime — macOS includes WebKit.

### Windows (Tauri desktop)

1. **Microsoft C++ Build Tools** — install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload.

2. **WebView2** — usually preinstalled on Windows 11. On Windows 10, install the [Evergreen WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

3. Use **PowerShell** or **Windows Terminal** for commands below.

---

## First-time setup

```bash
git clone https://github.com/scott-harrison/vaultlock.git
cd vaultlock

# Install all workspace JavaScript dependencies
pnpm install

# Backend environment (required for API)
cp .env.example .env
# Edit .env if you need a real RESEND_API_KEY for email verification
```

---

## Start the backend

### 1. Database

```bash
docker compose up postgres -d
```

Postgres is exposed on `localhost:5432` with user/password/database `vaultlock`.

### 2. API server

From the repo root (`.env` is loaded automatically via `dotenvy`):

```bash
cd backend
cargo run
```

You should see `listening on 0.0.0.0:8080`. Confirm with:

```bash
curl http://localhost:8080/health
# → ok
```

> **Note:** The `backend` service in `docker-compose.yml` expects a production Dockerfile (issue #8). For day-to-day development, run Postgres in Docker and the API with `cargo run`.

### Email verification in dev

Register requires a verification token. Without `RESEND_API_KEY`, the user is still created but no email is sent. Options:

- Set `RESEND_API_KEY` in `.env` (free tier at [resend.com](https://resend.com)), or
- Read `verification_token` from the `users` table after registering, or
- Use the Bruno collection under `docs/api/bruno/` for auth flows.

---

## Start the desktop app

From the repo root:

```bash
pnpm --filter @vaultlock/desktop tauri dev
```

Or from `desktop/`:

```bash
cd desktop
pnpm tauri dev
```

The first run compiles the Rust shell and may take several minutes. Subsequent runs are incremental.

You should see a native **Vaultlock** window with the placeholder UI.

### Desktop scripts

| Command | Description |
|---------|-------------|
| `pnpm --filter @vaultlock/desktop tauri dev` | Dev window + Vite HMR |
| `pnpm --filter @vaultlock/desktop tauri build` | Release bundle (`.app` / `.msi`) |
| `pnpm --filter @vaultlock/desktop build` | Frontend only → `desktop/dist/` |

---

## Monorepo commands (repo root)

```bash
pnpm format          # Biome + cargo fmt
pnpm lint            # Biome + cargo clippy
pnpm test            # Backend tests + @vaultlock/shared Vitest
pnpm exec biome check .
```

Pre-push hooks run Biome, `cargo fmt --check`, clippy, and backend tests.

---

## Project layout (clients)

```
vaultlock/
├── backend/          # Rust API (Axum + SQLx)
├── shared/           # @vaultlock/shared — crypto, types, API client
├── desktop/          # Tauri 2 + React (primary client)
├── extension/        # Plasmo browser extension
├── mobile/           # Expo (last client priority)
└── docs/
    └── DEV_ENVIRONMENT.md   ← this file
```

Import shared code in desktop:

```ts
import { deriveMasterKey } from "@vaultlock/shared/crypto";
import { VaultlockApiClient } from "@vaultlock/shared/api";
```

---

## Troubleshooting

### `pnpm install` fails with trust policy errors

Some workspace packages (e.g. mobile) may hit pnpm supply-chain policy. Install only what you need:

```bash
pnpm install --filter @vaultlock/desktop --filter @vaultlock/shared --config.trustPolicy=allow
```

### Port 5432 already in use

Stop the conflicting Postgres instance or change the host port in `docker-compose.yml`.

### Port 8080 already in use

Stop the other process or change the bind port in `backend/src/main.rs` (dev only).

### Port 1420 already in use (Tauri / Vite)

Tauri expects Vite on **1420** (`desktop/vite.config.ts`). Free the port or stop another Vaultlock dev session.

### Tauri build errors on macOS

- Run `xcode-select --install`
- Ensure `rustc` and `cargo` are on your PATH:

  ```bash
  source "$HOME/.cargo/env"
  cargo --version
  ```

  If `cargo --version` fails, install Rust from [rustup.rs](https://rustup.rs/) and add this to `~/.zshrc` (or `~/.zshenv`):

  ```bash
  . "$HOME/.cargo/env"
  ```

  **Cursor / VS Code terminals** sometimes start without `~/.cargo/bin` on `PATH`. Either restart the terminal after installing Rust, or run `source "$HOME/.cargo/env"` before `pnpm desktop:dev`.

### Tauri build errors on Windows

- Confirm **MSVC** toolchains are installed (not GNU alone)
- Install WebView2 Evergreen runtime

### Backend: `JWT_SECRET` not set

Copy `.env.example` to `.env` at the **repo root** before `cargo run`.

---

## Next steps (issue #72)

After **11-01** (this scaffold):

1. **11-02** — Server URL settings + health check
2. **11-03** — Wire `@vaultlock/shared` crypto
3. **11-04+** — Auth, unlock, vault CRUD, sync

See [issue #72](https://github.com/scott-harrison/vaultlock/issues/72) for the full desktop epic.
