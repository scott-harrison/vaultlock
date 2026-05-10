# Vaultlock GitHub Repository Guardrails

**Document Owner:** Project Manager & Architect  
**Version:** 1.0  
**Last Updated:** May 10, 2026  
**Alignment:** Phase 3 Security Hardening + Ongoing Compliance

---

## 1. Purpose & Scope

As a zero-knowledge password manager, Vaultlock's codebase is a high-value target. These guardrails establish defense-in-depth protections for the GitHub repository to prevent unauthorized changes, supply-chain attacks, secret leaks, and integrity violations. All guardrails are designed to be auditable, enforceable via automation, and aligned with our Core Principles of security, simplicity, and user control.

**Scope:** Applies to the `vaultlock` repository (and future monorepo structure). Covers source code, workflows, dependencies, and release processes.

---

## 2. Core Guardrail Principles

- **Least Privilege:** No direct writes to protected branches; all changes via reviewed PRs.
- **Defense in Depth:** Multiple overlapping controls (branch protection + scanning + signed commits + CI gates).
- **Automation First:** Guardrails enforced by GitHub-native features and required CI workflows; manual bypass only with documented justification and dual approval.
- **Transparency & Auditability:** All bypasses, reviews, and security events logged and reviewable.
- **Continuous Improvement:** Guardrails reviewed quarterly or after any security incident; expanded as the project matures (e.g., adding SLSA Level 3).

---

## 3. Branch Protection & Repository Rulesets

### 3.1 Main Branch Protection
- Require Pull Requests with at least 2 approving reviews (minimum 1 from security reviewer). No self-approval. Dismiss stale reviews.
- Require Status Checks: CI pipeline (tests, lint, build), CodeQL scan, Dependabot checks.
- Require Signed Commits (GPG/SSH).
- Do Not Allow: Force pushes, direct pushes, branch deletions on main.
- Require Linear History and conversation resolution.

### 3.2 Repository Rulesets (Preferred)
- Target main branch.
- Require PRs with 2 approvers, status checks, commit signing, linear history.
- Bypass limited to Security Admins team with audit trail and linked issue.
- Scheduled rules for dependency freshness.

**Action:** Configure via Settings > Rulesets in Phase 1. Document bypass process in CONTRIBUTING.md.

---

## 4. Secret Scanning & Leak Prevention
- Enable Secret Scanning with Push Protection for all pushes (GitHub default + custom Vaultlock patterns e.g. VAULTLOCK_[A-Z0-9]{32}).
- Integrate github___run_secret_scanning tool in CI; fail on detection.
- Remediation SLA: 24h for critical secrets.

---

## 5. Dependency & Supply Chain Security
- Enable Dependabot alerts, security updates (auto PRs), version updates (weekly, grouped).
- Generate SBOM (SPDX/CycloneDX) on releases using syft or GitHub action.
- Enable SLSA provenance via OIDC (target Level 2 initially).

---

## 6. Code Scanning & Analysis
- Enable CodeQL for Rust, JavaScript/TypeScript, YAML.
- Schedule on PRs + weekly; custom queries for crypto misuses (constant-time, key handling).
- Additional: cargo-audit, npm audit, clippy, eslint security plugins in CI.

---

## 7. CI/CD Workflow Guardrails
- Required "Guardrails" workflow on all PRs: secret scan + CodeQL + tests (≥80% coverage) + build reproducibility + license scan.
- Pin all actions to exact SHA.
- Use OIDC only; no long-lived secrets in repo.
- Environment protection for production: manual approval + wait time.

---

## 8. Access Control & Contributor Guardrails
- Enforce 2FA for all contributors.
- Team structure: core-maintainers (2-3 people), security-reviewers, contributors.
- No direct pushes to main; all via PRs.
- Invite-only with sponsor + security review.

---

## 9. Monitoring, Auditing & Incident Response
- Enable audit log export/SIEM integration.
- Private vulnerability reporting enabled.
- Maintain SECURITY.md with disclosure policy (48h ack, 90-day fix target).
- Document incident playbook in docs/incident-response.md.

---

## 10. Implementation Roadmap

- **Phase 1:** Enable secret scanning + push protection, basic branch protection, Dependabot (tied to existing issues #1, #8).
- **Phase 2:** Add CodeQL, rulesets, signed commits, SBOM.
- **Phase 3:** SLSA, custom queries, full audit integration.
- **Ongoing:** Quarterly reviews + red-team exercises.

**Metrics:** 100% PRs through protected path; zero secret leaks; <7 days critical alert remediation; <15% CodeQL false positives.

---

*Living document. Updates require PR under these guardrails. Questions? Open issue labeled `security`.*

**Maintained by Vaultlock Project Manager & Architect**