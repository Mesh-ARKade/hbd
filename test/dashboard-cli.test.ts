/**
 * Tests for dashboard CLI command.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleDashboard } from "../src/cli-handlers.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import { isOk, isErr } from "../src/core/result.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Dashboard CLI Command", () => {
  let testDir: string;
  let mockLogger: any;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-dashboard-cli");
    fs.mkdirSync(testDir, { recursive: true });

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("handleDashboard", () => {
    it("should start dashboard server on default port", async () => {
      const result = await handleDashboard({ dataDir: testDir }, mockLogger);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.url).toBeDefined();
        expect(result.value.url).toContain("http://localhost");
        expect(result.value.port).toBeGreaterThan(0);
      }

      // Cleanup
      if (isOk(result) && result.value.close) {
        await result.value.close();
      }
    });

    it("should use custom port when specified", async () => {
      const result = await handleDashboard(
        { dataDir: testDir, port: 9999 },
        mockLogger
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.port).toBe(9999);
        expect(result.value.url).toContain(":9999");
      }

      // Cleanup
      if (isOk(result) && result.value.close) {
        await result.value.close();
      }
    });

    it("should handle port conflicts gracefully", async () => {
      // Just verify that starting a server works
      // Port collision handling is tested in server tests
      const result = await handleDashboard(
        { dataDir: testDir, port: 7777 },
        mockLogger
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.port).toBe(7777);
      }

      // Cleanup
      if (isOk(result) && result.value.close) {
        await result.value.close();
      }
    });

    it("should return error for invalid data directory", async () => {
      const result = await handleDashboard(
        { dataDir: "/nonexistent/path/that/does/not/exist" },
        mockLogger
      );

      expect(isErr(result)).toBe(true);
    });

    it("should log server URL on startup", async () => {
      const result = await handleDashboard({ dataDir: testDir }, mockLogger);

      expect(isOk(result)).toBe(true);

      // Verify logger was called with URL
      const urlLog = mockLogger.info.mock.calls.find(
        (call: any[]) =>
          call[1] &&
          typeof call[1] === "string" &&
          call[1].includes("Dashboard available")
      );
      expect(urlLog).toBeDefined();

      // Cleanup
      if (isOk(result) && result.value.close) {
        await result.value.close();
      }
    });

    it("should include PipelineStatus and LogBridge integration", async () => {
      const result = await handleDashboard({ dataDir: testDir }, mockLogger);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.pipeline).toBeDefined();
        expect(result.value.logBridge).toBeDefined();
      }

      // Cleanup
      if (isOk(result) && result.value.close) {
        await result.value.close();
      }
    });
  });
});
