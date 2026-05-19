# Authentication Endpoints

## POST /register

Registers a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "master-password"
}
```

**Response:**
- `201 Created` on success
- `409 Conflict` if email already exists

**Note:** Email verification is stubbed for MVP.

## POST /login

Authenticates a user and returns JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "master-password"
}
```

**Response:**
- `200 OK` with `access_token` and `refresh_token`
- `401 Unauthorized` on invalid credentials

**Rate Limiting:** 5 requests per minute per IP