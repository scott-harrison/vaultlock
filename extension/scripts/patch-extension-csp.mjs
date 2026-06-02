#!/usr/bin/env node
/**
 * Plasmo dev for some targets (e.g. brave-mv3) replaces extension_pages CSP with
 * only `script-src 'self' http://localhost`, which breaks Argon2 (hash-wasm).
 * Re-apply wasm-unsafe-eval whenever the dev manifest is rewritten.
 */

import { existsSync, readFileSync, watch, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_PAGES_CSP =
  "script-src 'self' 'wasm-unsafe-eval' http://localhost; object-src 'self';";

export function patchManifestFile(manifestPath) {
  if (!existsSync(manifestPath)) {
    return false;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const current = manifest.content_security_policy?.extension_pages ?? "";

  if (current.includes("'wasm-unsafe-eval'")) {
    return false;
  }

  manifest.content_security_policy = {
    ...manifest.content_security_policy,
    extension_pages: EXTENSION_PAGES_CSP,
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  console.log(`[VaultLock] Patched CSP for WASM: ${manifestPath}`);
  return true;
}

function watchManifest(manifestPath) {
  const dir = dirname(manifestPath);
  patchManifestFile(manifestPath);

  watch(dir, (_event, filename) => {
    if (filename === "manifest.json") {
      patchManifestFile(manifestPath);
    }
  });
}

const target = process.argv[2] ?? "brave-mv3-dev";
const watchMode = process.argv.includes("--watch");
const manifestPath = join(root, "build", target, "manifest.json");

if (watchMode) {
  watchManifest(manifestPath);
} else {
  patchManifestFile(manifestPath);
}
