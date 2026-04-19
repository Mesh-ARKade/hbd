/**
 * Global vitest setup/teardown for test workspace sweeping.
 * Ensures no .hbd-* test directories persist between runs.
 * @packageDocumentation
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const TEST_PATTERNS = [
  ".hbd-test-",
  ".hbd-cli-",
  ".hbd-idx-",
  ".hbd-merge-",
  ".hbd-edge-",
  ".hbd-err-",
  ".hbd-init-",
  ".hbd-final-",
  ".hbd-p2p-test-",
  ".hbd-result-",
  ".hbd-dashboard-",
];

const PROTECTED_DIRS = [".hbd-data", ".hbd-dashboard"];

/**
 * Get test directories matching patterns.
 */
function getTestDirs(): string[] {
  try {
    const cwd = process.cwd();
    return fs
      .readdirSync(cwd)
      .filter((n) => TEST_PATTERNS.some((p) => n.startsWith(p)));
  } catch {
    return [];
  }
}

/**
 * Execute OS-native cleanup command.
 */
function osNativeRm(dirPath: string): void {
  try {
    const resolvedPath = path.resolve(dirPath);
    if (process.platform === "win32") {
      execSync(`rmdir /s /q "${resolvedPath}"`, { stdio: "ignore" });
    } else {
      execSync(`rm -rf "${resolvedPath}"`, { stdio: "ignore" });
    }
  } catch {
    // Best effort
  }
}

/**
 * Remove a directory recursively with OS fallback.
 */
function removeDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // Fallback to OS-native command
    osNativeRm(dirPath);
  }
}

/**
 * Sweep all test directories.
 */
export function sweepTestWorkspaces(): void {
  const dirs = getTestDirs();
  for (const dir of dirs) {
    const baseName = path.basename(dir);
    if (PROTECTED_DIRS.includes(baseName)) continue;
    removeDir(path.resolve(dir));
  }
}

/**
 * Global setup - runs once before all test files.
 */
export function setup(): void {
  sweepTestWorkspaces();
}

/**
 * Global teardown - runs once after all test files.
 */
export function teardown(): void {
  sweepTestWorkspaces();
}
