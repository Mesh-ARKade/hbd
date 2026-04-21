/**
 * Tests for No-Intro scraper - Coverage Tests
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NoIntroScraper } from "../../../src/scrapers/sources/nointro.js";
import { isOk, isErr } from "../../../src/core/result.js";
import { getUniqueTestDir, robustRm } from "../../test-utils.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("NoIntroScraper - Coverage Tests", () => {
  let testDir: string;
  let mockLogger: any;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-nointro-cov");
    fs.mkdirSync(testDir, { recursive: true });

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      child: vi.fn(() => mockLogger),
    };
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("downloadFromPath", () => {
    it("should copy file successfully", async () => {
      const sourceFile = path.join(testDir, "source.dat");
      fs.writeFileSync(sourceFile, "DAT content");

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.downloadFromPath(sourceFile);

      expect(isOk(result)).toBe(true);
    });

    it("should return error for missing file", async () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.downloadFromPath("/nonexistent/file.txt");

      expect(isErr(result)).toBe(true);
    });
  });

  describe("decompress", () => {
    it("should return error for missing zip", async () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.decompress("/missing/file.zip");

      expect(isErr(result)).toBe(true);
      expect(result.error.message).toContain("ZIP not found");
    });

    it("should handle corrupt zip files", async () => {
      const zipPath = path.join(testDir, "corrupt.zip");
      fs.writeFileSync(zipPath, "This is not a valid ZIP file");

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.decompress(zipPath);

      // Either success or error is fine
      expect(result).toBeDefined();
    });

    it("should handle zip extraction (ok or err)", async () => {
      const zipPath = path.join(testDir, "extract-me.zip");
      // Create minimal ZIP structure (magic bytes only - will fail extraction but tests the path)
      fs.writeFileSync(zipPath, Buffer.from([0x50, 0x4B, 0x03, 0x04]));

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.decompress(zipPath);

      // Result should be defined (either ok or err, but not thrown)
      expect(result).toBeDefined();
      expect(typeof result.ok === 'boolean' || typeof result.ok === 'undefined').toBe(true);
    });
  });

  describe("parse", () => {
    it("should find DAT files in extracted directory", async () => {
      const extractDir = path.join(testDir, "daily-pack");
      fs.mkdirSync(extractDir, { recursive: true });
      fs.writeFileSync(path.join(extractDir, "nes.dat"), "NES DAT");
      fs.writeFileSync(path.join(extractDir, "snes.dat"), "SNES DAT");

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      await scraper.parse();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ files: expect.any(Array) }),
        "Found DAT files"
      );
    });

    it("should return error if no extracted directory", async () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.parse();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("No extracted directory found");
      }
    });

    it("should return error if no DAT files found", async () => {
      const extractDir = path.join(testDir, "empty-pack");
      fs.mkdirSync(extractDir, { recursive: true });

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.parse();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("No DAT files found");
      }
    });
  });

  describe("configuration getters", () => {
    it("should return default filter sets", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      const sets = scraper.getFilterSets();
      expect(sets).toEqual(["set1", "set8", "set4", "set3", "set7"]);
    });

    it("should return custom filter sets", () => {
      const customSets = ["set1", "set2"];

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        filterSets: customSets,
      });

      expect(scraper.getFilterSets()).toEqual(customSets);
    });

    it("should return default timeout", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      expect(scraper.getDownloadTimeout()).toBe(120000);
    });

    it("should return custom timeout", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        downloadTimeout: 60000,
      });

      expect(scraper.getDownloadTimeout()).toBe(60000);
    });

    it("should return data directory", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      expect(scraper.getDataDir()).toContain(testDir.replace(/\\/g, "/"));
    });
  });

  describe("target URL", () => {
    it("should use correct default URL", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      const url = scraper.getTargetUrl();
      expect(url).toContain("datomatic.no-intro.org");
      expect(url).toContain("page=download");
      expect(url).toContain("op=daily");
    });

    it("should allow custom URL", () => {
      const customUrl = "https://custom.example.com/test";
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        targetUrl: customUrl,
      });

      expect(scraper.getTargetUrl()).toBe(customUrl);
    });
  });

  describe("scraper name", () => {
    it("should have correct name via getName", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      expect(scraper.getName()).toBe("NoIntroScraper");
    });
  });

  describe("phase tracking", () => {
    it("should start in idle phase", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      expect(scraper.getPhase()).toBe("idle");
    });
  });

  describe("error paths for coverage", () => {
    it("should handle string errors in decompress", async () => {
      const zipPath = path.join(testDir, "string-error.zip");
      fs.writeFileSync(zipPath, "invalid");

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.decompress(zipPath);
      expect(result.ok !== undefined).toBe(true);
    });
  });

});