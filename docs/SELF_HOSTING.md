# Self-Hosting Vaultlock

**Completely Free. Fully Yours. Accessible Anywhere.**

Vaultlock is designed from the ground up to be self-hosted with zero ongoing costs or vendor dependencies. This document provides everything you need to run Vaultlock on your own hardware or VPS — including secure remote access from anywhere in the world.

## Is Self-Hosting Free?

**Yes — 100% free and open source (MIT License).**

- No subscriptions
- No usage limits
- No telemetry or data collection
- No premium features locked behind paywalls

Your only costs are the infrastructure you choose:
- **Home server / Raspberry Pi / old PC**: ~$0–$5/month (electricity)
- **Cheap VPS** (e.g., Hetzner, DigitalOcean, Linode): $3–$6/month
- **Domain name** (optional but recommended): $8–$15/year

Cloudflare Tunnel and Tailscale are free for personal use and require no open ports or domain.

## High-Level Architecture for Self-Hosting

We use a modern, secure stack:

- **Caddy** (reverse proxy + automatic HTTPS via Let's Encrypt — free certificates)
- **PostgreSQL** (reliable database)
- **Rust Backend** (Axum + SQLx — high performance, memory-safe)
- **React Frontend** (served statically or via backend)

All sensitive operations (encryption/decryption, key derivation) happen **client-side** in your browser or app. The server never sees your master password or plaintext data.

## Quick Start: Local Network Only (Testing)

```bash
git clone https://github.com/scott-harrison/vaultlock.git
cd vaultlock

# Copy and customize environment
cp .env.example .env
nano .env   # Edit DB_PASSWORD and other secrets

# Start everything
docker compose up -d

# Access locally
open http://localhost:8080
```

**Note:** The production `docker-compose.yml` and `.env.example` are being finalized in Phase 3. This command will work once the backend container image is published (expected by end of Phase 1).

## Recommended Production Setup: Remote Access Anywhere

### Option 1: Easiest & Most Secure — Cloudflare Tunnel (Recommended for Most Users)

No port forwarding, no domain required, works behind CGNAT/firewalls.

1. Sign up at [cloudflare.com](https://dash.cloudflare.com) (free)
2. Install `cloudflared` on your server
3. Create a Tunnel in the Cloudflare dashboard
4. Point it to your internal backend port (e.g., `http://backend:8080`)
5. Access via `https://your-tunnel-id.cfargotunnel.com` (or custom subdomain)

**Pros:** Free, secure (Cloudflare handles TLS + DDoS), zero config on router.
**Cons:** Traffic routes through Cloudflare (still E2EE end-to-end for your vault data).

### Option 2: Traditional Domain + Caddy (Best Performance & Control)

1. Buy a domain (Namecheap, Cloudflare, etc.)
2. Point an A record to your server's public IP
3. Use our `docker-compose.yml` (includes Caddy)
4. Caddy automatically obtains and renews Let's Encrypt certificates

**Caddyfile example** (included in repo):

```
yourdomain.com {
    reverse_proxy backend:8080
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "no-referrer"
    }
}
```

### Option 3: VPN-Only Access (Maximum Privacy)

Use Tailscale or WireGuard:
- Install Tailscale on server and all your devices (free for up to 100 devices)
- Access Vaultlock via the private Tailscale IP (e.g., 100.x.x.x:8080)
- No exposure to the public internet at all

This is the most private option and works great for families or small teams.

## Detailed docker-compose.yml (Target Configuration)

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2.8
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: vaultlock
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: vaultlock
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vaultlock"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    # Will be replaced with pre-built image once published
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: "postgres://vaultlock:${DB_PASSWORD}@db:5432/vaultlock"
      JWT_SECRET: ${JWT_SECRET}
      RUST_LOG: info
      PORT: 8080
    depends_on:
      db:
        condition: service_healthy
    # No ports exposed — only accessible via Caddy

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

## Environment Variables (.env.example)

```env
# Database
DB_PASSWORD=your-super-secure-random-password-here

# JWT for session management (generate with: openssl rand -hex 32)
JWT_SECRET=your-64-char-hex-secret

# Optional: Admin panel token (for /admin)
ADMIN_TOKEN=another-long-random-string

# Caddy / Domain (only needed if using Option 2)
DOMAIN=yourdomain.com
```

**Security Note:** Never commit your `.env` file. Use Docker secrets or a secrets manager in production.

## First-Time Setup After Deployment

1. Open the web UI
2. Create your first account (email + master password)
3. The master password is **never sent to the server** — it derives your encryption keys locally
4. Import data from 1Password / Bitwarden / CSV if desired (export tools will be provided)

## Security Best Practices

- Use a strong, unique master password (we recommend a passphrase)
- Enable 2FA / passkeys on your account once supported
- Keep your server OS and Docker images updated
- Regular encrypted backups of the Postgres volume
- Consider fail2ban or CrowdSec for brute-force protection on the login endpoint
- For maximum security: run behind Tailscale + Caddy (defense in depth)

## Backup & Restore

```bash
# Backup
 docker compose exec db pg_dump -U vaultlock vaultlock > backup-$(date +%F).sql

# Restore
 docker compose exec -T db psql -U vaultlock vaultlock < backup.sql
```

## Troubleshooting

- **Can't connect locally:** Check `docker compose logs backend` and `docker compose ps`
- **HTTPS errors:** Ensure port 443 is open and DNS is correct; Caddy logs show certificate issues
- **Database connection failed:** Check `DB_PASSWORD` matches and Postgres is healthy
- **High memory usage:** Rust backend is very efficient; scale vertically if needed

## Current Status (May 2026)

The self-hosting stack is being implemented as part of **Phase 1 (Foundation)** and **Phase 3 (Polish & Self-Host)**. The `docker-compose.yml`, `Caddyfile`, and pre-built container images will be published as soon as the backend reaches MVP. Until then, this document serves as the authoritative guide and target specification.

Watch the GitHub repo for updates or join the discussion in the issues.

---

**Questions?** Open an issue or start a discussion on GitHub. We're committed to making self-hosting Vaultlock as painless and secure as possible.

*Maintained by the Vaultlock team — project manager & architect*