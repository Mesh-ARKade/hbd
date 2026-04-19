/**
 * Verification test for workspace cleanup.
 * Ensures no test directories persist after full test run.
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getUniqueTestDir, robustRm, sweepTestDirsFast } from "./test-utils.js";

describe("Test Workspace Cleanup Verification", () => {
  let testDir: string;

  beforeAll(() => {
    // Create a test directory to verify cleanup works
    testDir = getUniqueTestDir(".hbd-test-cleanup");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "test.txt"), "test data");
  });

  afterAll(async () => {
    await robustRm(testDir);
  });

  it("should clean up test directories using robustRm", async () => {
    const tempDir = getUniqueTestDir(".hbd-test-verify");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, "file.txt"), "content");

    expect(fs.existsSync(tempDir)).toBe(true);

    await robustRm(tempDir);

    expect(fs.existsSync(tempDir)).toBe(false);
  });

  it("should sweep all test directories with sweepTestDirsFast", () => {
    // Create multiple test directories
    const dirs = [
      getUniqueTestDir(".hbd-test-"),
      getUniqueTestDir(".hbd-cli-"),
      getUniqueTestDir(".hbd-idx-"),
    ];

    dirs.forEach((dir) => {
      fs.mkdirSync(dir, { recursive: true });
    });

    // Verify they exist
    dirs.forEach((dir) => {
      expect(fs.existsSync(dir)).toBe(true);
    });

    // Sweep them
    sweepTestDirsFast();

    // Verify they're gone
    dirs.forEach((dir) => {
      expect(fs.existsSync(dir)).toBe(false);
    });
  });

  it("should NOT delete protected directories", () => {
    // Create a protected directory
    const protectedDir = ".hbd-data";
    const wasCreated = !fs.existsSync(protectedDir);

    if (wasCreated) {
      fs.mkdirSync(protectedDir, { recursive: true });
    }

    // Create a regular test directory
    const testDir2 = getUniqueTestDir(".hbd-test-");
    fs.mkdirSync(testDir2, { recursive: true });

    // Sweep
    sweepTestDirsFast();

    // Protected directory should still exist
    expect(fs.existsSync(protectedDir)).toBe(true);

    // Test directory should be gone
    expect(fs.existsSync(testDir2)).toBe(false);

    // Clean up if we created it
    if (wasCreated) {
      fs.rmSync(protectedDir, { recursive: true, force: true });
    }
  });

  it("should handle non-existent directories gracefully", () => {
    // Should not throw
    expect(() => sweepTestDirsFast()).not.toThrow();
    expect(() => robustRm("/non/existent/path")).not.toThrow();
  });
});
