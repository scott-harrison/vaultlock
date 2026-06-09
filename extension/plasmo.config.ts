/**
 * Plasmo configuration for the VaultLock browser extension (Manifest V3).
 *
 * This file is the single source of truth for the extension manifest.
 * Later work will expand permissions and add content scripts as needed.
 */
import { defineConfig } from "plasmo";

export default defineConfig({
  manifest: {
    name: "VaultLock",
    description: "Secure. Simple. Yours. — Self-hosted password manager",
    version: "0.1.0",
    manifest_version: 3,

    // Core permissions needed from the start
    permissions: [
      "storage", // For server URL, tokens, encrypted vault cache, etc.
      "tabs", // Relay fill commands to the tab where the user clicked the indicator
    ],

    // SECURITY NOTE
    // Broad <all_urls> access is currently required for content script field detection
    // and future autofill across any site the user visits.
    //
    // This is a known high-risk permission. The long-term plan is to move toward
    // optional_permissions + dynamic origin requests (scoped to domains where the
    // user has saved credentials) or activeTab + user gesture patterns.
    //
    // Do not expand usage of this permission without a security review.
    host_permissions: ["<all_urls>"],

    action: {
      default_popup: "popup.html",
      default_title: "VaultLock",
    },

    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },

    // Firefox-specific settings (required for Firefox support)
    browser_specific_settings: {
      gecko: {
        id: "vaultlock@scott-harrison.dev", // Placeholder ID – can be updated later
        strict_min_version: "109.0", // Manifest V3 support
      },
    },

    // Argon2 (hash-wasm) requires WASM compilation in popup/options (extension_pages only).
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },

    // Content script match/run_at/all_frames are defined per file via exported `config`.
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["src/contents/extension-context-guard.ts"],
      },
      {
        matches: ["<all_urls>"],
        js: ["src/contents/password-field-detector.ts"],
      },
    ],
  },

  // Tell Plasmo to build for both major browsers during development
  // Usage: pnpm dev          → Chrome
  //        pnpm dev --target=firefox  → Firefox
  browsers: ["chrome", "firefox"],
});
