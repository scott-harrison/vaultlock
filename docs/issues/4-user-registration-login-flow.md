# Issue #4: User Registration + Login Flow

**Status:** In Progress

## Sub-tasks

- [ ] 4-01: Registration endpoint with email verification stub
- [ ] 4-02: Login endpoint with JWT issuance
- [ ] 4-03: Master password hash storage (Argon2id)
- [ ] 4-04: Rate limiting on auth endpoints
- [ ] 4-05: Comprehensive tests + documentation

## Acceptance Criteria

- [ ] POST /register with email + master password hash
- [ ] POST /login returns JWT
- [ ] Password never stored in plaintext
- [ ] Basic rate limiting on auth endpoints
