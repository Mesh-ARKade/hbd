/**
 * Test utilities for robust directory cleanup.
 * Handles Windows file locks from Hypercore.
 * @packageDocumentation
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

/**
 * Generate a unique test directory name.
 */
export function getUniqueTestDir(prefix: string = ".hbd-test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Execute OS-native cleanup command as fallback.
 * Uses rmdir /s /q on Windows, rm -rf on Unix.
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
    // Best effort - native command may also fail
  }
}

/**
 * Fast directory removal - simple attempt, no retries for afterAll hooks.
 * Falls back to OS-native command on Windows if fs.rmSync fails.
 * @param dirPath - Directory path to remove
 */
export function fastRm(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // Fallback to OS-native command for Windows file locks
    osNativeRm(dirPath);
  }
}

/**
 * Robust directory removal with retries for test cleanup.
 * Falls back to OS-native command after retries are exhausted.
 * @param dirPath - Directory path to remove
 */
export async function robustRm(
  dirPath: string,
  maxRetries: number = 5,
  delayMs: number = 200
): Promise<void> {
  if (!fs.existsSync(dirPath)) return;

  // Wait a bit for file handles to be released
  await new Promise((resolve) => setTimeout(resolve, 50));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch {
      if (attempt === maxRetries) {
        // Final fallback to OS-native command
        osNativeRm(dirPath);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

/**
 * Get test directories matching a pattern.
 */
function getTestDirs(pattern: string): string[] {
  try {
    return fs.readdirSync(".").filter((n) => n.startsWith(pattern));
  } catch {
    return [];
  }
}

/**
 * Fast sweep of all test directories.
 * NOTE: Does NOT touch .hbd-data (production directory)
 * Call this in afterAll hooks - uses fastRm for speed.
 */
export function sweepTestDirsFast(): void {
  const patterns = [
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

  for (const pattern of patterns) {
    const dirs = getTestDirs(pattern);
    dirs.forEach((dir) => {
      // NEVER delete production data directory
      if (path.basename(dir) === ".hbd-data") return;
      fastRm(path.resolve(dir));
    });
  }
}

/**
 * Async sweep for beforeAll/afterAll hooks with timeout handling.
 */
export async function sweepTestDirsWithTimeout(
  timeoutMs: number = 5000
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      sweepTestDirsFast();
      resolve();
    }, 100); // Small delay to let other cleanup finish first
  });
}

/**
 * Register process exit handler for final cleanup sweep.
 * This catches cases where tests are interrupted (Ctrl+C, crashes).
 */
export function registerExitCleanup(): void {
  const cleanup = (): void => {
    sweepTestDirsFast();
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  // Windows doesn't support SIGINT/SIGTERM the same way
  if (process.platform === "win32") {
    process.on("SIGHUP", () => {
      cleanup();
      process.exit(0);
    });
  }
}

// Auto-register exit cleanup when this module is imported
registerExitCleanup();
