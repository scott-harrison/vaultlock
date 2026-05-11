# Testing Standards for Vaultlock

---

## 1. Testing Philosophy

Testing is a **core security control** for Vaultlock. Because we are building a zero-knowledge password manager, every line of code that touches encryption, key management, or user data must be rigorously verified.

We follow these principles:
- **Shift-left testing**: Tests are written alongside (or before) implementation.
- **Defense in depth**: Multiple layers of testing (unit → integration → E2E → security/fuzzing).
- **High coverage with quality**: We target high coverage but prioritize meaningful tests over artificial metrics.
- **Security-first**: Special emphasis on constant-time operations, side-channel resistance, and property-based testing for cryptographic code.
- **Living documentation**: Tests serve as executable specifications.

---

## 2. Coverage Targets

| Layer              | Minimum Coverage | Notes                                      |
|--------------------|------------------|--------------------------------------------|
| Unit Tests         | ≥ 90%            | Per crate / module                         |
| Integration Tests  | Core flows 100%  | Auth, vault CRUD, encryption round-trips   |
| E2E / Browser      | Critical paths   | Login, password generation, sync           |
| Security/Fuzzing   | N/A (targeted)   | Crypto modules, key derivation, parsers    |

Coverage is enforced in CI. PRs that drop below thresholds are blocked.

---

## 3. Tooling by Layer

### 3.1 Backend (Rust)
- **Unit & Integration**: `cargo test` + `#[tokio::test]`
- **Coverage**: `cargo tarpaulin` or `llvm-cov` (HTML + LCOV reports uploaded to GitHub)
- **Property-Based Testing**: `proptest` and `quickcheck`
- **Fuzzing**: `cargo-fuzz` + `libFuzzer` (especially for parsers and crypto boundaries)
- **Constant-Time Verification**: `cargo-ct` or manual review + `dudect`

### 3.2 Web Frontend (React / Next.js)
- **Unit & Component**: `Vitest` + React Testing Library
- **Integration / API**: MSW (Mock Service Worker) for contract testing
- **E2E**: Playwright (recommended) or Cypress
- **Visual Regression**: Percy or Chromatic (future)

### 3.3 Mobile (React Native)
- **Unit & Component**: Jest + React Native Testing Library
- **E2E**: Detox or Maestro
- **Integration**: MSW or `msw` + `react-native-testing-library`

### 3.4 Cross-Cutting
- **API Contract Testing**: OpenAPI spec + `pact` or `reqwest` + snapshot testing
- **Performance**: Criterion.rs (Rust) and Lighthouse / Web Vitals (frontend)

---

## 4. CI/CD Testing Requirements

Every PR to `main` **must** pass the following gates (enforced via required status checks):

1. All unit + integration tests pass
2. Coverage ≥ 85% (with per-crate thresholds)
3. No new high/critical CodeQL or Dependabot findings
4. Secret scanning passes
5. Linting and formatting checks pass (`cargo clippy`, `eslint`, `prettier`)

**Branch Protection Rule**: Merging is blocked until all gates are green.

---

## 5. Security & Cryptographic Testing

Special requirements for security-sensitive code:

- All cryptographic functions must have **property-based tests** covering edge cases (invalid inputs, maximum sizes, timing).
- Key derivation (Argon2id) and encryption (AES-256-GCM) modules require **fuzzing** and **constant-time verification**.
- No secrets or test vectors with real user data are allowed in the repository.
- Side-channel resistance tests (timing, cache) are required for any new crypto code.

---

## 6. Test Organization & Naming

- Tests live next to the code they test (`src/foo.rs` → `src/foo_test.rs` or `tests/foo.rs`).
- Use descriptive names: `test_encrypt_roundtrip_with_invalid_key` not `test_encrypt_2`.
- Integration tests go in `tests/` directory (black-box style).
- Use `#[ignore]` sparingly and only with clear justification + linked issue.

---

## 7. Contribution Guidelines

- New features must include unit + integration tests before merge.
- Bug fixes must include a regression test.
- Crypto changes require an additional security review + property/fuzz tests.
- Update `TESTING.md` when introducing new testing tools or raising coverage targets.

---

## 8. Metrics & Reporting

- Coverage reports are published on every push (visible in PRs and GitHub UI).
- We track:
  - Overall coverage trend
  - Flaky test rate (< 1% target)
  - Time to first test failure on new code
- Quarterly review of testing effectiveness during project retrospectives.

---

## 9. Future Enhancements (Phase 2+)

- Mutation testing (`cargo-mutants`)
- Chaos engineering for sync and offline scenarios
- Formal verification for critical cryptographic components (if resources allow)
- Automated accessibility + security scanning in E2E tests

---

*This document is a living standard. Changes require a PR with at least one security reviewer approval.*