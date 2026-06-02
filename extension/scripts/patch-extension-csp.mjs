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

/** Plasmo dev sometimes omits these; without them chrome.storage is undefined. */
const REQUIRED_PERMISSIONS = ["storage", "tabs"];
const REQUIRED_HOST_PERMISSIONS = ["<all_urls>"];

function mergeRequiredManifestFields(manifest) {
  let changed = false;

  const permissions = new Set([...(manifest.permissions ?? []), ...REQUIRED_PERMISSIONS]);
  const nextPermissions = [...permissions];
  if (
    !manifest.permissions ||
    nextPermissions.length !== manifest.permissions.length ||
    !REQUIRED_PERMISSIONS.every((p) => manifest.permissions.includes(p))
  ) {
    manifest.permissions = nextPermissions;
    changed = true;
  }

  const hostPermissions = new Set([
    ...(manifest.host_permissions ?? []),
    ...REQUIRED_HOST_PERMISSIONS,
  ]);
  const nextHostPermissions = [...hostPermissions];
  if (
    !manifest.host_permissions ||
    nextHostPermissions.length !== manifest.host_permissions.length ||
    !REQUIRED_HOST_PERMISSIONS.every((p) => manifest.host_permissions.includes(p))
  ) {
    manifest.host_permissions = nextHostPermissions;
    changed = true;
  }

  return changed;
}

export function patchManifestFile(manifestPath) {
  if (!existsSync(manifestPath)) {
    return false;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let changed = mergeRequiredManifestFields(manifest);

  const current = manifest.content_security_policy?.extension_pages ?? "";
  if (!current.includes("'wasm-unsafe-eval'")) {
    manifest.content_security_policy = {
      ...manifest.content_security_policy,
      extension_pages: EXTENSION_PAGES_CSP,
    };
    changed = true;
  }

  if (!changed) {
    return false;
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  console.log(`[VaultLock] Patched dev manifest (permissions + CSP): ${manifestPath}`);
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
