# ADR-0001: Monorepo Layout for Vaultlock

**Status:** Proposed  
**Date:** May 11, 2026  
**Deciders:** Project Manager & Architect  
**Related Issues:** #1 (Monorepo + Rust backend skeleton)

---

## Context

Vaultlock requires a clean, maintainable, and testable codebase that supports:
- Rust backend (Axum + SQLx + PostgreSQL)
- React web frontend (Vite/Next.js + Tailwind + shadcn/ui)
- React Native mobile app (Expo)
- Browser extension (Plasmo)
- Tauri desktop app (future)

A monorepo allows us to share types, testing utilities, and CI configuration while keeping the project easy to navigate and develop.

## Decision

We will use a **monorepo** with the following top-level structure:

```
vaultlock/
├── backend/                 # Rust (Axum + SQLx)
│   ├── src/
│   ├── tests/
│   ├── Cargo.toml
│   └── ...
├── frontend/                # React (Vite or Next.js)
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── ...
├── mobile/                  # React Native (Expo)
│   ├── src/
│   ├── tests/
│   └── package.json
├── extension/               # Browser extension (Plasmo)
│   ├── src/
│   └── package.json
├── shared/                  # Common types, crypto utils, testing helpers
│   ├── types/
│   ├── crypto/
│   └── testing/
├── docs/
│   └── adr/
│       └── api/             # Bruno API collections
├── .github/
│   └── workflows/           # Shared CI (tests, coverage, security, linting)
├── docker-compose.yml
├── TESTING.md
└── README.md
```

**Key Principles:**
- Each major layer has its own directory with its own build/test tooling.
- `shared/` contains language-agnostic types and crypto primitives that can be consumed by frontend and backend.
- All testing follows the standards defined in `TESTING.md` (≥90% unit coverage, integration tests, CI gates).

## Code Quality & Formatting Standards

To maintain strict coding standards across the entire monorepo we use **Biome.js** as the single source of truth for:

- Linting
- Formatting
- Import sorting

**Scope**: All JavaScript/TypeScript, JSON, Markdown, and CSS files.

### Shared Biome Configuration

We will use a **single root-level `biome.json`** that defines all rules. Each TypeScript app (`frontend/`, `mobile/`, `extension/`) will extend this root config:

```json
// frontend/biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "extends": ["../biome.json"]
}
```

This guarantees that **all TypeScript apps follow exactly the same rules** with zero duplication.

**Enforcement**:
- Pre-commit hooks (via `husky` + `lint-staged`)
- Required CI check on every PR (fails the build on any lint or formatting issues)
- Strict configuration: no `any`, consistent import order, no unused variables, max line length 100, etc.

**Rust side**: `cargo clippy` (linting) + `rustfmt` (formatting) are enforced in the same CI pipeline.

This ensures a consistent, professional, and high-quality codebase that directly supports our rigorous testing standards.

## API Documentation & Testing (Bruno)

We will use **Bruno** for API documentation and automated API testing.

**Location**: `docs/api/bruno/`

**Benefits**:
- Git-native (collections stored as plain text files)
- No cloud dependency (perfect for self-hosted project)
- Built-in test assertions (can be run in CI)
- Easy to keep in sync with the actual API

Bruno collections will be versioned alongside the code and used for both manual exploration and automated integration testing.

## Alternatives Considered

1. **Separate repositories** (backend, frontend, mobile, extension)
   - Pros: Independent deployment, smaller repos
   - Cons: Harder to share types/crypto, duplicated CI, version drift, more overhead for contributors
   - Rejected: Increases friction for a small team and makes end-to-end testing difficult.

2. **Single Rust + embedded frontend** (e.g., Tauri-only from day one)
   - Pros: Simpler initially
   - Cons: Delays web + mobile development, contradicts our cross-platform goals
   - Rejected: We need web + mobile early.

3. **Yarn/Nx-style monorepo with heavy tooling**
   - Pros: Powerful workspace management
   - Cons: Overkill for our scale and adds complexity
   - Rejected: Keep it simple (plain Cargo workspaces + npm workspaces).

## Consequences

**Positive:**
- Single source of truth for types and crypto
- Easy to run full test suite locally and in CI
- Consistent developer experience
- Supports our strong testing focus (shared test utilities, coverage reporting across packages)
- Strict, automated code quality via Biome + Clippy + rustfmt
- Zero duplication of linting rules across apps
- Professional, version-controlled API documentation with Bruno

**Negative / Risks:**
- Larger repo size (mitigated by good `.gitignore` and sparse checkout if needed)
- CI time may grow (mitigated by parallel jobs and caching)
- Contributors must understand the layout (mitigated by this ADR and clear README)

## Implementation Notes

- Use Cargo workspaces in `backend/Cargo.toml` for any internal crates.
- Use npm workspaces in root `package.json` if needed for frontend/mobile.
- Add root-level scripts: `npm run test:all`, `npm run coverage`, `npm run lint`, `npm run format`
- Enforce `TESTING.md` standards and Biome rules in every package from the first commit.
- Bruno collections will be added under `docs/api/bruno/` starting in Phase 1

---

*This ADR will be updated if the layout evolves significantly.*