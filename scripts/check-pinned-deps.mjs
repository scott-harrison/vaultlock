#!/usr/bin/env node
/**
 * Ensures workspace package.json and pnpm-workspace.yaml overrides use exact
 * versions (no ^ or ~). workspace: protocol and non-semver specifiers are allowed.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

const WORKSPACE_PROTOCOL = /^workspace:/;
const RANGE_CHARS = /[~^]/;
function findPackageJsonFiles(dir, results = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) {
      continue;
    }
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      findPackageJsonFiles(path, results);
      continue;
    }
    if (name === "package.json") {
      results.push(path);
    }
  }
  return results;
}

function collectPackageViolations(packagePath) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const rel = relative(root, packagePath);
  const violations = [];

  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps || typeof deps !== "object") {
      continue;
    }
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version !== "string") {
        continue;
      }
      if (WORKSPACE_PROTOCOL.test(version)) {
        continue;
      }
      if (RANGE_CHARS.test(version)) {
        violations.push({ rel, name, version });
      }
    }
  }

  return violations;
}

function collectOverrideViolations() {
  const rel = "pnpm-workspace.yaml";
  const lines = readFileSync(join(root, rel), "utf8").split("\n");
  const violations = [];
  let inOverrides = false;

  for (const line of lines) {
    if (line === "overrides:") {
      inOverrides = true;
      continue;
    }
    if (!inOverrides) {
      continue;
    }
    if (line.trim() === "" || !line.startsWith(" ")) {
      break;
    }
    const colon = line.lastIndexOf(": ");
    if (colon === -1) {
      continue;
    }
    const target = line.slice(1, colon).trim();
    const version = line.slice(colon + 2).trim();
    if (RANGE_CHARS.test(version)) {
      violations.push({ rel, name: target, version });
    }
  }

  return violations;
}

const violations = [
  ...findPackageJsonFiles(root).flatMap(collectPackageViolations),
  ...collectOverrideViolations(),
];

if (violations.length > 0) {
  console.error("Dependency versions must be exact (no ^ or ~):\n");
  for (const { rel, name, version } of violations) {
    console.error(`  ${rel} → ${name}: ${version}`);
  }
  console.error("\nPin the resolved version from pnpm-lock.yaml, then run pnpm install.");
  process.exit(1);
}

console.log("All dependency versions are pinned (no ^ or ~).");
