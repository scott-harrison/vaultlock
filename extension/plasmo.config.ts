/**
 * Plasmo configuration for the VaultLock browser extension (Manifest V3).
 *
 * This file is the single source of truth for the extension manifest during 12-01.
 * Later sub-tasks (especially 12-06/12-07) will expand permissions and add content scripts.
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
    ],

    // We start broad. In later sub-tasks we can scope this down per-origin
    // once the user has configured their server URL.
    host_permissions: ["<all_urls>"],

    action: {
      default_popup: "popup.html",
      default_title: "VaultLock",
      // default_icon will be added when we have proper icons (post 12-01)
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
  },

  // Tell Plasmo to build for both major browsers during development
  // Usage: pnpm dev          → Chrome
  //        pnpm dev --target=firefox  → Firefox
  browsers: ["chrome", "firefox"],
});
