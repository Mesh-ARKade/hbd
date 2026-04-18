/**
 * Test utilities for robust directory cleanup.
 * Handles Windows file locks from Hypercore.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Generate a unique test directory name.
 */
export function getUniqueTestDir(prefix: string = ".hbd-test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fast directory removal - simple attempt, no retries for afterAll hooks.
 * @param dirPath - Directory path to remove
 */
export function fastRm(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // Best effort - ignore lock errors in afterAll
  }
}

/**
 * Robust directory removal with retries for test cleanup.
 * @param dirPath - Directory path to remove
 */
export async function robustRm(
  dirPath: string, 
  maxRetries: number = 3, 
  delayMs: number = 150
): Promise<void> {
  if (!fs.existsSync(dirPath)) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch {
      if (attempt === maxRetries) return;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Get test directories matching a pattern.
 */
function getTestDirs(pattern: string): string[] {
  try {
    return fs.readdirSync(".").filter(n => n.startsWith(pattern));
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
  const patterns = [".hbd-test-", ".hbd-cli-", ".hbd-idx-", ".hbd-merge-", ".hbd-edge-", ".hbd-err-"];
  
  for (const pattern of patterns) {
    const dirs = getTestDirs(pattern);
    dirs.forEach(dir => {
      // NEVER delete production data directory
      if (path.basename(dir) === ".hbd-data") return;
      fastRm(path.resolve(dir));
    });
  }
}

/**
 * Async sweep for beforeAll/afterAll hooks with timeout handling.
 */
export async function sweepTestDirsWithTimeout(timeoutMs: number = 5000): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      sweepTestDirsFast();
      resolve();
    }, 100); // Small delay to let other cleanup finish first
  });
}