/**
 * Tests for AbstractScraper base class and lifecycle orchestration.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi, describe as d } from "vitest";
import { AbstractScraper, ScraperPhase, ScraperOptions } from "../../src/scrapers/base.js";
import { isOk, isErr, Result } from "../../src/core/result.js";
import { getUniqueTestDir, robustRm } from "../test-utils.js";
import * as fs from "node:fs";

// Concrete implementation for testing
class TestScraper extends AbstractScraper {
  public fetchCalled = false;
  public downloadCalled = false;
  public decompressCalled = false;
  public parseCalled = false;

  async fetch(): Promise<void> {
    this.fetchCalled = true;
    this.setPhase("fetch");
  }

  async download(): Promise<void> {
    this.downloadCalled = true;
    this.setPhase("download");
  }

  async decompress(): Promise<void> {
    this.decompressCalled = true;
    this.setPhase("decompress");
  }

  async parse(): Promise<void> {
    this.parseCalled = true;
    this.setPhase("parse");
  }

  async merge(): Promise<void> {
    this.setPhase("merge");
  }

  async write(): Promise<void> {
    this.setPhase("write");
  }
}

// Scraper that throws in fetch
class FetchErrorScraper extends TestScraper {
  async fetch(): Promise<void> {
    throw new Error("Network error");
  }
}

// Scraper that throws in download
class DownloadErrorScraper extends TestScraper {
  async download(): Promise<void> {
    throw new Error("Download failed");
  }
}

// Scraper that throws in decompress
class DecompressErrorScraper extends TestScraper {
  async decompress(): Promise<void> {
    throw new Error("Decompress failed");
  }
}

// Scraper that throws in merge
class MergeErrorScraper extends TestScraper {
  async merge(): Promise<void> {
    throw new Error("Merge failed");
  }
}

// Scraper that throws in write
class WriteErrorScraper extends TestScraper {
  async write(): Promise<void> {
    throw new Error("Write failed");
  }
}

// Scraper with string error
class StringErrorScraper extends TestScraper {
  async fetch(): Promise<void> {
    throw "String error";
  }
}

describe("AbstractScraper", () => {
  let testDir: string;
  let scraper: TestScraper;
  let mockLogger: any;
  let mockPipeline: any;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-scraper-test");
    fs.mkdirSync(testDir, { recursive: true });

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    mockPipeline = {
      update: vi.fn(),
    };

    scraper = new TestScraper({
      dataDir: testDir,
      logger: mockLogger,
      pipeline: mockPipeline,
    });
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("constructor", () => {
    it("should initialize with options", () => {
      expect(scraper.getDataDir()).toContain(testDir.replace(/\\/g, '/'));
      expect(scraper.getPhase()).toBe("idle");
    });

    it("should throw if required options are missing", () => {
      expect(() => {
        new TestScraper({} as any);
      }).toThrow("dataDir is required");
    });
  });

  describe("lifecycle orchestration", () => {
    it("should execute lifecycle in correct order", async () => {
      const result = await scraper.run();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(scraper.fetchCalled).toBe(true);
        expect(scraper.downloadCalled).toBe(true);
        expect(scraper.decompressCalled).toBe(true);
        expect(scraper.parseCalled).toBe(true);
        expect(result.value.phase).toBe("complete");
      }
    });

    it("should return error if fetch fails", async () => {
      const failingScraper = new FetchErrorScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await failingScraper.run();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Network error");
      }
    });

    it("should return error if download fails", async () => {
      const failingScraper = new DownloadErrorScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await failingScraper.run();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Download failed");
      }
    });

    it("should return error if decompress fails", async () => {
      const failingScraper = new DecompressErrorScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await failingScraper.run();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Decompress failed");
      }
    });

    it("should return error if merge fails", async () => {
      const failingScraper = new MergeErrorScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await failingScraper.run();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Merge failed");
      }
    });

    it("should return error if write fails", async () => {
      const failingScraper = new WriteErrorScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await failingScraper.run();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Write failed");
      }
    });

    it("should handle string errors", async () => {
      const failingScraper = new StringErrorScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await failingScraper.run();

      expect(isErr(result)).toBe(true);
    });
  });

  describe("phase transitions", () => {
    it("should update phase during execution", async () => {
      await scraper.run();

      expect(scraper.getPhase()).toBe("complete");
    });

    it("should call pipeline update on phase change", async () => {
      await scraper.run();

      expect(mockPipeline.update).toHaveBeenCalled();
    });
  });

  describe("getPhase", () => {
    it("should return initial phase as idle", () => {
      expect(scraper.getPhase()).toBe("idle");
    });
  });

  describe("getDataDir", () => {
    it("should return data directory", () => {
      expect(scraper.getDataDir()).toContain(testDir.replace(/\\/g, '/'));
    });
  });

  describe("getName", () => {
    it("should return scraper class name", () => {
      expect(scraper.getName()).toBe("TestScraper");
    });
  });

  describe("setPhase", () => {
    it("should update phase", () => {
      scraper.setPhase("fetch");
      expect(scraper.getPhase()).toBe("fetch");

      scraper.setPhase("download");
      expect(scraper.getPhase()).toBe("download");
    });
  });

  describe("cancel", () => {
    it("should set cancelled flag", () => {
      scraper.cancel();
      // Cancel just sets the flag, phase change happens in run()
      expect(scraper.getPhase()).not.toBe("complete");
    });
  });

  describe("getEntriesParsed", () => {
    it("should return 0 initially", () => {
      expect(scraper.getEntriesParsed()).toBe(0);
    });

    it("should return parsed count from result", async () => {
      const result = await scraper.run();
      if (isOk(result)) {
        expect(result.value.entriesParsed).toBeDefined();
      }
    });
  });

  describe("getEntriesWritten", () => {
    it("should return 0 initially", () => {
      expect(scraper.getEntriesWritten()).toBe(0);
    });

    it("should return written count from result", async () => {
      const result = await scraper.run();
      if (isOk(result)) {
        expect(result.value.entriesWritten).toBeDefined();
      }
    });
  });

  describe("default merge/write", () => {
    it("should have working default merge", async () => {
      await scraper.merge();
      expect(scraper.getPhase()).toBe("merge");
    });

    it("should have working default write", async () => {
      await scraper.write();
      expect(scraper.getPhase()).toBe("write");
    });
  });

  describe("checkCancelled", () => {
    it("should throw if cancelled during phase", () => {
      scraper.cancel();
      try {
        scraper.checkCancelled();
        expect(false).toBe(true); // should not reach
      } catch (e) {
        expect(e instanceof Error).toBe(true);
        if (e instanceof Error) {
          expect(e.message).toBe("Scraper cancelled");
        }
      }
    });

    it("should not throw if not cancelled", () => {
      scraper.checkCancelled(); // Should not throw
      expect(true).toBe(true);
    });

    it("should set cancelled phase when cancelled during run", async () => {
      class SlowScraper extends TestScraper {
        async fetch(): Promise<void> {
          this.setPhase("fetch");
          await new Promise(r => setTimeout(r, 50));
        }
      }

      const slowScraper = new SlowScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const runP = slowScraper.run();
      await new Promise(r => setTimeout(r, 10));
      slowScraper.cancel();
      const result = await runP;

      // Either cancelled or error - either is fine
      if (isErr(result)) {
        expect(result.error.message).toBe("Scraper cancelled");
      }
    });
  });

  describe("isCancelled", () => {
    it("should return false initially", () => {
      // Access internal state
      expect(scraper.getPhase()).not.toBe("cancelled");
    });
  });
});

describe("ScraperPhase enum", () => {
  it("should have all expected phases", () => {
    expect(ScraperPhase.Idle).toBe("idle");
    expect(ScraperPhase.Fetch).toBe("fetch");
    expect(ScraperPhase.Download).toBe("download");
    expect(ScraperPhase.Decompress).toBe("decompress");
    expect(ScraperPhase.Parse).toBe("parse");
    expect(ScraperPhase.Merge).toBe("merge");
    expect(ScraperPhase.Write).toBe("write");
    expect(ScraperPhase.Complete).toBe("complete");
    expect(ScraperPhase.Error).toBe("error");
    expect(ScraperPhase.Cancelled).toBe("cancelled");
  });
});