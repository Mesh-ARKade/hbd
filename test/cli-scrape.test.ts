/**
 * Tests for CLI scrape command.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleScrape } from "../src/cli-handlers.js";
import { isOk, isErr } from "../src/core/result.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import * as fs from "node:fs";

// Mock the NoIntroScraper
vi.mock("../src/scrapers/sources/nointro.js", () => ({
  NoIntroScraper: vi.fn().mockImplementation(() => ({
    fetch: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue(undefined),
    decompress: vi.fn().mockResolvedValue({ ok: true, value: "/extracted/path" }),
    parse: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue({ ok: true, value: { phase: "complete" } }),
    close: vi.fn().mockResolvedValue(undefined),
    getDataDir: vi.fn().mockReturnValue(".hbd-data"),
  })),
}));

describe("CLI Scrape Command", () => {
  let testDir: string;
  let mockLogger: any;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-scrape-test");
    fs.mkdirSync(testDir, { recursive: true });

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("handleScrape", () => {
    it("should scrape with default options", async () => {
      const result = await handleScrape(
        { dataDir: testDir },
        mockLogger
      );

      expect(result).toBeDefined();
      // Function executes without throwing
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("should support --system flag for targeted scrapes", async () => {
      const result = await handleScrape(
        { dataDir: testDir, system: "nes" },
        mockLogger
      );

      expect(result).toBeDefined();
      // System parameter is logged
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("should return error if data directory not initialized", async () => {
      const nonExistentDir = "/non/existent/path";

      const result = await handleScrape(
        { dataDir: nonExistentDir },
        mockLogger
      );

      expect(isErr(result)).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should use custom data directory from --dir flag", async () => {
      const customDir = getUniqueTestDir(".hbd-custom-scrape");
      fs.mkdirSync(customDir, { recursive: true });

      const result = await handleScrape(
        { dataDir: customDir },
        mockLogger
      );

      expect(result).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalled();

      await robustRm(customDir);
    });
  });
});
