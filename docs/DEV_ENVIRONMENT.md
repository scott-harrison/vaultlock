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
| **Node.js** | 24 LTS (Active) | [nodejs.org](https://nodejs.org/) or `nvm install` (uses `.nvmrc`) |
| **pnpm** | 11.x | `npm install -g pnpm@11` |
| **Rust** | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Docker** | latest | [docker.com](https://www.docker.com/products/docker-desktop/) |

Verify:

```bash
node --version    # v24.x
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

You should see a native **Vaultlock** window with the **Server connection** settings screen (sub-task 11-02).

1. Enter your backend URL (default `http://localhost:8080`)
2. Click **Test connection** — calls `GET /health` via `@vaultlock/shared`
3. Click **Save** — persists the URL in Tauri's local store (`settings.json`)

Start the backend first (see [Start the backend](#start-the-backend)) to get a successful health check.

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

Pre-push hooks run Biome, `cargo fmt --check`, clippy, and backend tests (now with reliable Postgres startup via healthcheck + `--wait`).

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

## npm dependency versions

Workspace `package.json` files and `pnpm-workspace.yaml` overrides must use **exact** semver versions — no `^` or `~`. The repo enforces this with:

```bash
pnpm check:deps
```

`pnpm add` is configured via `.npmrc` (`save-prefix=`) to write exact versions by default. After bumping a dependency, run `pnpm install` and commit the updated `pnpm-lock.yaml`.

---

## Troubleshooting

### `pnpm install` fails with trust policy errors

The repo uses `trustPolicy: no-downgrade` in `pnpm-workspace.yaml`. If a new package triggers `ERR_PNPM_TRUST_DOWNGRADE`, prefer a version `overrides` entry with an exact target (see `semver@<7` → `7.8.0` for the Babel/mobile case).

To install only desktop + shared without pulling mobile:

```bash
pnpm install --filter @vaultlock/desktop --filter @vaultlock/shared
```

### Port 5432 already in use (or Postgres not ready)

Multiple dev sessions, stale containers, or the pre-push hook can leave Postgres instances
running under different compose project names (e.g. `vaultlock-postgres-1`, `extension-postgres-1`).

**Quick recovery:**

```bash
# Stop anything listening on 5432
docker ps --filter "publish=5432" --format "{{.Names}}" | xargs -r docker stop
docker ps --filter "publish=5432" --format "{{.Names}}" | xargs -r docker rm -f

# Clean start
docker compose down postgres
docker compose up postgres -d
```

**Root cause of hook failures ("postgres admin connection: PoolTimedOut"):**

The pre-push hook (and `pnpm test`) run `scripts/test-backend.sh`, which starts Postgres
and then immediately runs the Rust integration tests. Postgres can take 10–20s to become
ready (especially on macOS + Docker Desktop + volume init).

We fixed this by:
- Adding a `healthcheck` to the `postgres` service in `docker-compose.yml`.
- Changing the script to use `docker compose up postgres --wait -d`.

After this change, both the hook and `pnpm test` are much more reliable.

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

### Touch ID / Face ID in macOS dev builds

Unsigned debug builds cannot always access the macOS data-protection keychain. The desktop app handles this as follows:

- **`pnpm desktop:dev`** on macOS uses `desktop/scripts/macos-dev-runner.sh` to ad-hoc sign the debug binary with keychain entitlements before launch.
- If keychain storage still fails in dev, the app falls back to `biometric-dev-fallback.json` (local file) while still requiring a biometric prompt. Settings shows a notice when this dev fallback is active.
- **Release builds** (`pnpm --filter @vaultlock/desktop tauri build`) use the system keychain — test biometrics on release builds before trusting dev behavior.

See [BIOMETRIC_QUICK_UNLOCK.md](./BIOMETRIC_QUICK_UNLOCK.md) for user-facing security guidance.

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
