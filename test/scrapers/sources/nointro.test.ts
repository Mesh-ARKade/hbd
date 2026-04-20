/**
 * Tests for No-Intro scraper using Playwright.
 * Comprehensive mocking to achieve 90%+ coverage.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getUniqueTestDir, robustRm } from "../../test-utils.js";
import { isOk, isErr } from "../../../src/core/result.js";

// Track mock calls
const mockCalls = {
  launch: 0,
  newPage: 0,
  goto: 0,
  locator: 0,
  check: 0,
  isChecked: 0,
  click: 0,
  waitFor: 0,
  screenshot: 0,
  close: 0,
};

// Mock Playwright with factory pattern
vi.mock("playwright", () => {
  const mockLocator = {
    click: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    isChecked: vi.fn().mockResolvedValue(false),
    waitFor: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockReturnThis(),
  };

  const mockPage = {
    goto: vi.fn().mockImplementation(() => {
      mockCalls.goto++;
      return Promise.resolve(undefined);
    }),
    locator: vi.fn().mockImplementation(() => {
      mockCalls.locator++;
      return mockLocator;
    }),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("")),
    close: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue("<html></html>"),
  };

  const mockBrowser = {
    newPage: vi.fn().mockImplementation(() => {
      mockCalls.newPage++;
      return Promise.resolve(mockPage);
    }),
    close: vi.fn().mockImplementation(() => {
      mockCalls.close++;
      return Promise.resolve(undefined);
    }),
  };

  return {
    chromium: {
      launch: vi.fn().mockImplementation(() => {
        mockCalls.launch++;
        return Promise.resolve(mockBrowser);
      }),
    },
  };
});

// Track adm-zip calls
const mockExtractAllTo = vi.fn().mockImplementation(() => {
  // Simulate extraction by creating the directory
});

// Mock adm-zip
vi.mock("adm-zip", () => ({
  default: vi.fn().mockImplementation(() => ({
    extractAllTo: mockExtractAllTo,
  })),
}));

// Import after mocks
import { NoIntroScraper } from "../../../src/scrapers/sources/nointro.js";

describe("NoIntroScraper", () => {
  let testDir: string;
  let mockLogger: any;
  let mockPipeline: any;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-nointro-test");
    fs.mkdirSync(testDir, { recursive: true });

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    mockPipeline = {
      update: vi.fn(),
    };

    // Reset mock call counts
    Object.keys(mockCalls).forEach((key) => {
      mockCalls[key as keyof typeof mockCalls] = 0;
    });
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("constructor", () => {
    it("should initialize with data directory", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      expect(scraper.getDataDir()).toContain(testDir.replace(/\\/g, "/"));
    });

    it("should require data directory", () => {
      expect(() => {
        new NoIntroScraper({} as any);
      }).toThrow("dataDir is required");
    });

    it("should have default target URL", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      expect(scraper.getTargetUrl()).toContain("no-intro.org");
    });
  });

  describe("fetch", () => {
    it("should launch browser and navigate to daily page", async () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      await scraper.fetch();

      expect(mockCalls.launch).toBe(1);
      expect(mockCalls.newPage).toBe(1);
      expect(mockCalls.goto).toBe(1);
    });

    it("should log navigation info", async () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      await scraper.fetch();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.any(String) }),
        "Navigating to No-Intro daily page"
      );
    });


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
    it("should return error for missing zip file", async () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      const result = await scraper.decompress("/nonexistent.zip");

      expect(isErr(result)).toBe(true);
    });


  });

  describe("parse", () => {
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
  });

  describe("close", () => {
    it("should close browser and page", async () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        logger: mockLogger,
      });

      // Initialize browser first
      await scraper.fetch();

      await scraper.close();

      expect(mockCalls.close).toBeGreaterThan(0);
    });
  });

  describe("url configuration", () => {
    it("should use correct default URL", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      const url = scraper.getTargetUrl();
      expect(url).toContain("datomatic.no-intro.org");
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

  describe("filter sets", () => {
    it("should default to official sets", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      const sets = scraper.getFilterSets();
      expect(sets).toContain("set1");
      expect(sets).toContain("set8");
    });

    it("should allow custom filter sets", () => {
      const customSets = ["set1", "set2"];

      const scraper = new NoIntroScraper({
        dataDir: testDir,
        filterSets: customSets,
      });

      expect(scraper.getFilterSets()).toEqual(customSets);
    });
  });

  describe("timeout configuration", () => {
    it("should default to 120 second timeout", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
      });

      expect(scraper.getDownloadTimeout()).toBe(120000);
    });

    it("should allow custom timeout", () => {
      const scraper = new NoIntroScraper({
        dataDir: testDir,
        downloadTimeout: 60000,
      });

      expect(scraper.getDownloadTimeout()).toBe(60000);
    });
  });
});
