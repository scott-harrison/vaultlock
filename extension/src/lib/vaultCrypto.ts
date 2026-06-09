/**
 * Vault crypto helpers for the browser extension.
 *
 * This module provides a thin, extension-friendly wrapper around
 * @vaultlock/shared/crypto for encrypting and decrypting vault items.
 *
 * It follows the same patterns as the desktop app (see desktop/src/lib/vaultCrypto.ts).
 */

export { decryptVaultItem, encryptVaultItemPlaintext } from "./vaultItemCrypto";
