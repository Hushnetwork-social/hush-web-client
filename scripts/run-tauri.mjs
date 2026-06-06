import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WINDOWS_MSVC_TOOLCHAIN = 'stable-x86_64-pc-windows-msvc';

const args = process.argv.slice(2);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const isWindows = process.platform === 'win32';
const env = { ...process.env };

function runCapture(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function hasRustupToolchain(toolchain) {
  const result = runCapture('rustup', ['toolchain', 'list']);

  if (result.status !== 0) {
    return false;
  }

  return result.stdout
    .split(/\r?\n/)
    .some((line) => line.trim().startsWith(toolchain));
}

function configureWindowsRustToolchain() {
  if (!isWindows || env.RUSTUP_TOOLCHAIN?.includes('windows-msvc')) {
    return;
  }

  if (!hasRustupToolchain(WINDOWS_MSVC_TOOLCHAIN)) {
    console.error(
      `[tauri-env] Missing Rust toolchain ${WINDOWS_MSVC_TOOLCHAIN}. Install it with: rustup toolchain install ${WINDOWS_MSVC_TOOLCHAIN}`,
    );
    process.exit(1);
  }

  const previousToolchain = env.RUSTUP_TOOLCHAIN;
  env.RUSTUP_TOOLCHAIN = WINDOWS_MSVC_TOOLCHAIN;

  if (previousToolchain) {
    console.log(`[tauri-env] Switching Rust toolchain from ${previousToolchain} to ${WINDOWS_MSVC_TOOLCHAIN}`);
    return;
  }

  console.log(`[tauri-env] Using Rust toolchain ${WINDOWS_MSVC_TOOLCHAIN}`);
}

function resolveTauriCommand() {
  const localTauriCli = path.join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

  if (existsSync(localTauriCli)) {
    return {
      command: process.execPath,
      args: [localTauriCli, ...args],
    };
  }

  return {
    command: isWindows ? 'tauri.cmd' : 'tauri',
    args,
  };
}

configureWindowsRustToolchain();

let child;

try {
  const tauriCommand = resolveTauriCommand();

  child = spawn(tauriCommand.command, tauriCommand.args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    shell: false,
  });
} catch (error) {
  console.error(`[tauri-env] Failed to start Tauri: ${error.message}`);
  process.exit(1);
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`[tauri-env] Failed to start Tauri: ${error.message}`);
  process.exit(1);
});
