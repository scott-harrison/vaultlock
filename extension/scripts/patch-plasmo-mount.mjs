#!/usr/bin/env node
/**
 * Plasmo mounts popup/options via DOMContentLoaded only. In some extension
 * popup contexts that event has already fired before the deferred bundle runs,
 * leaving a blank page. Patch generated static entries and built bundles.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const STATIC_MOUNT_SOURCE = `let __plasmoRoot: HTMLElement = null

function __plasmoMount() {
  if (!!__plasmoRoot) {
    return
  }

  __plasmoRoot = document.getElementById("__plasmo")
  if (!__plasmoRoot) {
    return
  }

  const root = createRoot(__plasmoRoot)

  const Layout = getLayout(Component)

  root.render(
    <Layout>
      <Component.default />
    </Layout>
  )
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", __plasmoMount)
} else {
  __plasmoMount()
}`;

const STATIC_MOUNT_PATTERN =
  /let __plasmoRoot: HTMLElement = null\s+document\.addEventListener\("DOMContentLoaded", \(\) => \{[\s\S]*?\}\)/m;

const BUNDLE_MOUNT_PATTERN =
  /let (\w+)=null;document\.addEventListener\("DOMContentLoaded",\(\)=>\{if\(\1\)return;\1=document\.getElementById\("__plasmo"\);let (\w+)=\(0,(\w+)\.createRoot\)\(\1\),(\w+)=\(0,(\w+)\.getLayout\)\((\w+)\);\2\.render\(\(0,(\w+)\.jsx\)\(\4,\{children:\(0,\7\.jsx\)\(\6\.default,\{\}\)\}\)\)\}\)/g;

function patchStaticEntry(path) {
  if (!existsSync(path)) {
    return false;
  }

  const source = readFileSync(path, "utf8");
  if (!STATIC_MOUNT_PATTERN.test(source)) {
    return false;
  }

  const next = source.replace(STATIC_MOUNT_PATTERN, STATIC_MOUNT_SOURCE);
  writeFileSync(path, next);
  console.log(`[VaultLock] Patched Plasmo mount: ${path}`);
  return true;
}

function patchBundleFile(path) {
  if (!existsSync(path)) {
    return false;
  }

  const source = readFileSync(path, "utf8");
  const replacement = (
    _match,
    rootVar,
    createRootVar,
    createRootMod,
    layoutVar,
    layoutMod,
    componentMod,
    jsxMod,
  ) =>
    `let ${rootVar}=null;function __plasmoMount(){if(${rootVar})return;${rootVar}=document.getElementById("__plasmo");if(!${rootVar})return;let ${createRootVar}=(0,${createRootMod}.createRoot)(${rootVar}),${layoutVar}=(0,${layoutMod}.getLayout)(${componentMod});${createRootVar}.render((0,${jsxMod}.jsx)(${layoutVar},{children:(0,${jsxMod}.jsx)(${componentMod}.default,{})}))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",__plasmoMount):__plasmoMount()`;

  const next = source.replace(BUNDLE_MOUNT_PATTERN, replacement);
  if (next === source) {
    return false;
  }

  writeFileSync(path, next);
  console.log(`[VaultLock] Patched bundle mount: ${path}`);
  return true;
}

function patchBuildOutput(buildDir) {
  const dir = join(root, "build", buildDir);
  if (!existsSync(dir)) {
    return;
  }

  for (const name of readdirSync(dir)) {
    if (/^popup\.[a-f0-9]+\.js$/.test(name) || /^options\.[a-f0-9]+\.js$/.test(name)) {
      patchBundleFile(join(dir, name));
    }
  }
}

export function patchStaticEntries() {
  const staticDir = join(root, ".plasmo", "static");
  for (const name of ["popup.tsx", "options.tsx"]) {
    patchStaticEntry(join(staticDir, name));
  }
}

export function patchAllBuildOutputs() {
  const buildRoot = join(root, "build");
  if (!existsSync(buildRoot)) {
    return;
  }

  for (const target of readdirSync(buildRoot)) {
    if (target.endsWith("-dev") || target.endsWith("-prod")) {
      patchBuildOutput(target);
    }
  }
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  patchStaticEntries();
  patchAllBuildOutputs();
}
