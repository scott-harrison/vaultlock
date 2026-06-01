#!/usr/bin/env node
/**
 * Runs `plasmo dev` and keeps the dev manifest CSP compatible with Argon2 WASM.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { patchManifestFile } from "./patch-extension-csp.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] ?? "brave-mv3";
const buildDir = `${target}-dev`;
const manifestPath = join(root, "build", buildDir, "manifest.json");

// Fixed ports so a reload after restarting dev still matches the baked HMR client.
const HMR_PORT = "1815";
const SERVE_PORT = "1012";

const child = spawn(
  "pnpm",
  [
    "exec",
    "plasmo",
    "dev",
    "--",
    `--target=${target}`,
    `--hmr-port=${HMR_PORT}`,
    `--serve-port=${SERVE_PORT}`,
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

const interval = setInterval(() => {
  patchManifestFile(manifestPath);
}, 1500);

function shutdown(code) {
  clearInterval(interval);
  process.exit(code ?? 0);
}

child.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => {
  child.kill("SIGINT");
});
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});