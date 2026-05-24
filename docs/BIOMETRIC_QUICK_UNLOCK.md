# Biometric Quick Unlock

Optional **biometric quick unlock** lets you reopen a locked vault on this device using Touch ID, Face ID, or Windows Hello — without typing your master password every time.

**Important:** Quick unlock is a convenience feature on top of your master password. It is **not** a replacement for your master password. You still need your master password to sign in on a new device, after sign-out, and periodically based on your security settings.

---

## What it does

When you enable quick unlock (desktop app only today):

1. You sign in and unlock the vault with your **master password** as usual.
2. In **Settings → Security**, you turn on Touch ID / Face ID / Windows Hello quick unlock.
3. Vaultlock generates a random key on this device and stores it in your operating system's secure storage, protected by biometrics or your device PIN.
4. Vaultlock encrypts your vault encryption key with that random key and saves the encrypted blob locally on this device.
5. After the vault **auto-locks** (idle timeout), you can unlock again with biometrics instead of re-entering your master password.

Your self-hosted server is **not involved** in biometric unlock. No fingerprint data, face templates, or unlock keys are sent to the server.

---

## What it does not do

Quick unlock **does not**:

- Replace your master password for account sign-in or recovery
- Sync to other devices — each device must enroll separately after a master-password unlock
- Protect against malware running while the vault is unlocked
- Protect a stolen device if the attacker knows your master password
- Work in the browser extension or mobile app yet (planned for a future release)

If biometrics fail, are unavailable, or you cancel the prompt, use your **master password** — it always works.

---

## How to enable (desktop)

1. Sign in and unlock the vault with your master password.
2. Open **Settings → Security**.
3. Configure **Auto-lock** and **Master password re-authentication** if you want (see below).
4. Turn on **Touch ID / Face ID / Windows Hello quick unlock**.
5. Confirm the system biometric prompt.

You can disable quick unlock anytime from the same settings screen.

---

## Security settings

### Auto-lock

Locks the vault after a period of inactivity while you remain signed in.

| Option | Behavior |
|--------|----------|
| 1 minute | Stricter — vault locks quickly when idle |
| **5 minutes** | **Default** |
| 15 minutes | More convenient |
| Never | Vault stays unlocked until you lock manually or quit |

When auto-lock runs, only the in-memory encryption key is cleared. Your biometric enrollment stays active so you can quick-unlock again.

### Master password re-authentication

Even with biometrics enabled, Vaultlock can require your master password again after a set interval.

| Option | Behavior |
|--------|----------|
| Every day | Most strict |
| **Every 7 days** | **Default** |
| Every 30 days | Less frequent |
| Never | Biometrics only until you sign out or disable them |

When re-authentication is due, the unlock screen hides the biometric button and asks for your master password. After a successful master-password unlock, biometrics work again until the next interval.

---

## When quick unlock is cleared

Vaultlock removes biometric enrollment on this device when you:

- **Sign out**
- **Change the server URL** (you are signed out and local account data is cleared)
- **Disable** quick unlock in Settings → Security

Locking the vault or auto-lock does **not** remove enrollment.

---

## Platform support

| Platform | Quick unlock |
|----------|--------------|
| macOS (desktop app) | Touch ID or Face ID |
| Windows (desktop app) | Windows Hello |
| Linux (desktop app) | Depends on device — if unavailable, use master password only |
| Browser extension | Not yet available |
| Mobile app | Not yet available |

---

## Recommendations

- Use a **strong master password** — biometrics guard the device, not your account against offline attack.
- Keep **auto-lock** enabled (default 5 minutes) on shared or portable machines.
- Keep **periodic master password re-auth** enabled (default 7 days).
- Enable **full-disk encryption** and a **screen lock** on your computer (FileVault, BitLocker, etc.).
- Do not rely on quick unlock alone on a device others can physically access.

---

## For self-hosters

Biometric quick unlock is entirely **client-side**. Your Docker stack, environment variables, and TLS setup do not need any biometric-specific configuration. See [SELF_HOSTING.md](./SELF_HOSTING.md) for server deployment.

---

## Technical details

For architecture, threat model, and implementation decisions, see:

- [ADR-0003: Biometric Quick Unlock](./adr/0003-biometric-quick-unlock.md)
- [Secure Biometric Vault Unlock (design plan)](./plans/secure-biometric-unlock.md)
