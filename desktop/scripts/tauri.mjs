import { spawnSync } from "node:child_process";
import { constants, accessSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(__dirname, "..");
const cargoDir = join(homedir(), ".cargo", "bin");
const cargoName = platform() === "win32" ? "cargo.exe" : "cargo";
const cargoPath = join(cargoDir, cargoName);

const pathKey = platform() === "win32" ? "Path" : "PATH";
const env = { ...process.env };
const currentPath = env[pathKey] ?? "";

if (!currentPath.split(platform() === "win32" ? ";" : ":").includes(cargoDir)) {
  env[pathKey] = `${cargoDir}${platform() === "win32" ? ";" : ":"}${currentPath}`;
}

try {
  accessSync(cargoPath, constants.X_OK);
} catch {
  console.error("error: cargo not found — Tauri requires the Rust toolchain.\n");
  console.error("Install Rust:");
  console.error("  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh");
  console.error("\nThen reload your shell:");
  console.error('  source "$HOME/.cargo/env"');
  console.error("\nVerify:");
  console.error("  cargo --version");
  process.exit(1);
}

const tauriCli = join(
  desktopRoot,
  "node_modules",
  ".bin",
  platform() === "win32" ? "tauri.cmd" : "tauri",
);
const args = process.argv.slice(2);

const result = spawnSync(tauriCli, args, {
  cwd: desktopRoot,
  env,
  stdio: "inherit",
  shell: platform() === "win32",
});

process.exit(result.status ?? 1);
