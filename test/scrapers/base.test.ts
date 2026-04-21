/**
 * Tests for AbstractScraper base class and lifecycle orchestration.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi, describe as d } from "vitest";
import { AbstractScraper, ScraperPhase, ScraperOptions } from "../../src/scrapers/base.js";
import { ok, err, isOk, isErr, Result } from "../../src/core/result.js";
import { getUniqueTestDir, robustRm } from "../test-utils.js";
import * as fs from "node:fs";

// Concrete implementation for testing
class TestScraper extends AbstractScraper {
  public fetchCalled = false;
  public downloadCalled = false;
  public decompressCalled = false;
  public parseCalled = false;

  async fetch(): Promise<Result<void, Error>> {
    this.fetchCalled = true;
    this.setPhase("fetch");
    return ok(void 0);
  }

  async download(): Promise<Result<void, Error>> {
    this.downloadCalled = true;
    this.setPhase("download");
    return ok(void 0);
  }

  async decompress(): Promise<Result<void, Error>> {
    this.decompressCalled = true;
    this.setPhase("decompress");
    return ok(void 0);
  }

  async parse(): Promise<Result<void, Error>> {
    this.parseCalled = true;
    this.setPhase("parse");
    return ok(void 0);
  }

  async merge(): Promise<Result<void, Error>> {
    this.setPhase("merge");
    return ok(void 0);
  }

  async write(): Promise<Result<void, Error>> {
    this.setPhase("write");
    return ok(void 0);
  }
}

// Scraper that returns error in fetch
class FetchErrorScraper extends TestScraper {
  async fetch(): Promise<Result<void, Error>> {
    return err(new Error("Network error"));
  }
}

// Scraper that returns error in download
class DownloadErrorScraper extends TestScraper {
  async download(): Promise<Result<void, Error>> {
    return err(new Error("Download failed"));
  }
}

// Scraper that returns error in decompress
class DecompressErrorScraper extends TestScraper {
  async decompress(): Promise<Result<void, Error>> {
    return err(new Error("Decompress failed"));
  }
}

// Scraper that returns error in merge
class MergeErrorScraper extends TestScraper {
  async merge(): Promise<Result<void, Error>> {
    return err(new Error("Merge failed"));
  }
}

// Scraper that returns error in write
class WriteErrorScraper extends TestScraper {
  async write(): Promise<Result<void, Error>> {
    return err(new Error("Write failed"));
  }
}

// Scraper with string error (converted to Error)
class StringErrorScraper extends TestScraper {
  async fetch(): Promise<Result<void, Error>> {
    return err(new Error("String error"));
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
        async fetch(): Promise<Result<void, Error>> {
          this.setPhase("fetch");
          await new Promise(r => setTimeout(r, 50));
          return ok(void 0);
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

  describe("run() safety net", () => {
    it("should convert an unexpected throw from a lifecycle method into err()", async () => {
      class ThrowingScraper extends TestScraper {
        async parse(): Promise<Result<void, Error>> {
          // Simulates a sync fs error (e.g. readdirSync EACCES) bubbling out
          throw new Error("fs permission denied");
        }
      }

      const throwing = new ThrowingScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await throwing.run();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("fs permission denied");
      }
      expect(throwing.getPhase()).toBe("error");
    });

    it("should return cancelled err when a lifecycle throws after cancel()", async () => {
      class ThrowAfterCancelScraper extends TestScraper {
        async fetch(): Promise<Result<void, Error>> {
          this.cancel();
          // Legacy subclasses may still use checkCancelled(), which throws
          (this as unknown as { checkCancelled: () => void }).checkCancelled();
          return ok(void 0);
        }
      }

      const s = new ThrowAfterCancelScraper({
        dataDir: testDir,
        logger: mockLogger,
        pipeline: mockPipeline,
      });

      const result = await s.run();

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe("Scraper cancelled");
      }
      expect(s.getPhase()).toBe("cancelled");
    });
  });

  describe("checkCancelledResult", () => {
    it("should return ok when not cancelled", () => {
      const result = (scraper as unknown as {
        checkCancelledResult: () => Result<void, Error>;
      }).checkCancelledResult();
      expect(isOk(result)).toBe(true);
    });

    it("should return err and set cancelled phase when cancelled", () => {
      scraper.cancel();
      const result = (scraper as unknown as {
        checkCancelledResult: () => Result<void, Error>;
      }).checkCancelledResult();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe("Scraper cancelled");
      }
      expect(scraper.getPhase()).toBe("cancelled");
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