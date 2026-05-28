/**
 * Plasmo configuration for the VaultLock browser extension.
 *
 * Manifest V3 + TypeScript + React.
 * We keep this minimal in 12-01 and will expand it in later sub-tasks.
 */
import { defineConfig } from "plasmo";

export default defineConfig({
  manifest: {
    name: "VaultLock",
    description: "Secure. Simple. Yours. — Self-hosted password manager",
    version: "0.1.0",
    manifest_version: 3,
    permissions: [
      "storage",
      // We will add more (tabs, scripting, etc.) in later sub-tasks when needed for autofill
    ],
    host_permissions: [
      // Will be configurable at runtime via options, but we need a broad permission for now
      // or use declarativeNetRequest / host permissions per origin later.
      "<all_urls>",
    ],
    action: {
      default_popup: "popup.html",
      default_title: "VaultLock",
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  },
});
