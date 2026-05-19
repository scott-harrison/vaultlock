# Issue #4: User Registration + Login Flow

**Status:** Complete

## Sub-tasks

- [x] 4-01: Registration endpoint with email verification stub
- [x] 4-02: Login endpoint with JWT issuance
- [x] 4-03: Master password hash storage (Argon2id)
- [x] 4-04: Rate limiting on auth endpoints
- [x] 4-05: Comprehensive tests + documentation

## Acceptance Criteria

- [x] POST /register with email + master password hash
- [x] POST /login returns JWT
- [x] Password never stored in plaintext
- [x] Basic rate limiting on auth endpoints

## API Endpoints

### POST /register

Creates a new user account. The client derives the master password with Argon2id and sends the PHC hash string; the server never receives the plaintext password.

**Request body:**

```json
{
  "email": "user@example.com",
  "master_password_hash": "$argon2id$v=19$m=19456,t=2,p=1$..."
}
```

**Responses:**

- `201 Created` — registration succeeded; verification email stub logged server-side
- `400 Bad Request` — invalid Argon2id hash format
- `409 Conflict` — email already registered
- `429 Too Many Requests` — auth rate limit exceeded

### POST /verify-email

Verifies a user's email using the token stored at registration. Issues JWT access and refresh tokens on success.

**Request body:**

```json
{
  "token": "<verification-token>"
}
```

**Responses:**

- `200 OK` — returns `access_token`, `token` (alias), and `refresh_token`
- `400 Bad Request` — invalid or expired token

### POST /login

Authenticates a verified user by comparing client-supplied and stored Argon2id master password hashes in constant time.

**Request body:**

```json
{
  "email": "user@example.com",
  "master_password_hash": "$argon2id$v=19$m=19456,t=2,p=1$..."
}
```

**Responses:**

- `200 OK` — returns JWT tokens (`access_token`, `token`, `refresh_token`)
- `401 Unauthorized` — invalid credentials
- `403 Forbidden` — email not verified
- `429 Too Many Requests` — auth rate limit exceeded

## Security Notes

- Master passwords are hashed client-side; the server stores and compares Argon2id PHC strings only.
- Auth endpoints share an in-memory IP rate limiter (5 requests per 60 seconds per IP).
- Login applies progressive delay after repeated failures (see Issue #2).
- Email verification is currently a stub that logs the token via `tracing`; replace with a real mailer before production.

## Testing

Integration tests live in `backend/tests/auth_integration.rs` and use Testcontainers to spin up PostgreSQL:

```bash
cd backend
JWT_SECRET=test-secret cargo test auth_integration
```

Unit tests cover Argon2 hash validation, JWT round-trips, and rate limiter behavior via `cargo test`.
