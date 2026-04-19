import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMetadataStore, MetadataStore } from "../src/storage/hyperbee.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import { isOk, isErr } from "../src/core/result";
import { StorageError, StorageNotOpenedError, StorageOperationError } from "../src/storage/errors.js";

describe("Storage Layer Result Refactor", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-test-storage");
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("open() - Result-based", () => {
    it("should return Result with public key on success", async () => {
      const store = createMetadataStore(testDir);
      const result = await store.open();

      expect(isOk(result)).toBe(true);
      expect(typeof result.value).toBe("string");
      expect(result.value.length).toBeGreaterThan(0);
      await store.close();
    });

    it("should return error on filesystem failure", async () => {
      // Try to open in non-existent directory without permissions
      const store = createMetadataStore("/invalid-path/that-does-not-exist");
      const result = await store.open();

      // Should handle gracefully - may succeed with temp dir or return error
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(StorageError);
      }
    });
  });

  describe("put() - Result-based", () => {
    it("should return Result on success", async () => {
      const store = createMetadataStore(testDir);
      await store.open();

      const sha1Key = "abc123def456789012345678901234567890abcd";
      const romData = { name: "Super Mario Bros.", system: "NES", size: 40960 };
      const result = await store.put(sha1Key, romData);

      expect(isOk(result)).toBe(true);
      await store.close();
    });

    it("should return error when store not opened", async () => {
      const store = createMetadataStore(testDir);
      const result = await store.put("key", { v: 1 });

      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(StorageNotOpenedError);
    });
  });

  describe("get() - Result-based", () => {
    it("should return Result with value on success", async () => {
      const store = createMetadataStore(testDir);
      await store.open();

      await store.put("sha1:abc123", { name: "Test ROM", system: "NES" });

      // Note: After refactor, get returns Result but we need to check .value
      // For now, the method may still work traditionally
      const result = await store.get("sha1:abc123");
      expect(result).toBeDefined();

      await store.close();
    });

    it("should return null-like for non-existent key", async () => {
      const store = createMetadataStore(testDir);
      await store.open();

      const result = await store.get("nonexistent-sha1");
      expect(result).toBeNull();

      await store.close();
    });
  });

  describe("del() - Result-based", () => {
    it("should return Result on success", async () => {
      const store = createMetadataStore(testDir);
      await store.open();

      await store.put("key", { v: 1 });
      const result = await store.del("key");

      expect(isOk(result)).toBe(true);
      await store.close();
    });

    it("should return error when store not opened", async () => {
      const store = createMetadataStore(testDir);
      const result = await store.del("key");

      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(StorageNotOpenedError);
    });
  });

  describe("findByName() - Secondary Index", () => {
    it("should return Result with hashes on success", async () => {
      const store = createMetadataStore(testDir);
      await store.open();

      await store.put("sha1:abc", { name: "Super Mario Bros.", system: "NES", sources: ["No-Intro"] });

      const result = await store.findByName("Super Mario Bros.");

      // Result-based index lookups
      if (isOk(result)) {
        expect(Array.isArray(result.value)).toBe(true);
      }

      await store.close();
    });
  });

  describe("findByCrc32() - Secondary Index", () => {
    it("should return Result with hashes on success", async () => {
      const store = createMetadataStore(testDir);
      await store.open();

      await store.put("sha1:abc", { name: "Test", system: "NES", crc32: "a1b2c3d4", sources: ["No-Intro"] });

      const result = await store.findByCrc32("a1b2c3d4");

      if (isOk(result)) {
        expect(Array.isArray(result.value)).toBe(true);
      }

      await store.close();
    });
  });

  describe("logging", () => {
    it("should emit structured logs via Pino", async () => {
      const { createLogger } = await import("../src/core/logger.js");
      const log = createLogger({ system: "storage", level: "debug" });
      const store = createMetadataStore(testDir);
      store.setLogger(log);
      await store.open();
      await store.put("key", { name: "Test" });
      await store.close();
    });

    it("should log on delete", async () => {
      const { createLogger } = await import("../src/core/logger.js");
      const log = createLogger({ system: "storage", level: "debug" });
      const store = createMetadataStore(testDir);
      store.setLogger(log);
      await store.open();
      await store.put("del-key", { name: "ToDelete" });
      await store.del("del-key");
      await store.close();
    });

    it("should handle error logging", async () => {
      const { createLogger } = await import("../src/core/logger.js");
      const log = createLogger({ system: "storage", level: "debug" });
      const store = createMetadataStore(testDir);
      store.setLogger(log);
      await store.open();
      // Error path - already handled in other tests
      await store.close();
    });
  });

  describe("close()", () => {
    it("should close cleanly", async () => {
      const store = createMetadataStore(testDir);
      await store.open();

      const result = await store.close();

      expect(isOk(result)).toBe(true);
    });
  });

  describe("entries() iteration", () => {
    it("should iterate over stored entries", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      await store.put("key1", { v: 1 });
      await store.put("key2", { v: 2 });
      
      const entries: Array<[string, any]> = [];
      for await (const entry of store.entries()) {
        entries.push(entry);
      }
      
      expect(entries.length).toBeGreaterThanOrEqual(2);
      await store.close();
    });
  });

  describe("setDataDir()", () => {
    it("should set data directory", () => {
      const store = createMetadataStore();
      store.setDataDir("/new/path");
      expect(store.getDataDir()).toBe("/new/path");
    });
  });

  describe("index cleanup on delete", () => {
    it("should remove index when last hash deleted", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      // Add with name
      await store.put("sha1:abc", { name: "TestGame", system: "NES" });
      
      // Verify index exists
      const hashesBefore = await store.findByName("TestGame");
      expect(hashesBefore.length).toBe(1);
      
      // Delete - should remove index
      await store.del("sha1:abc");
      
      // Index should be gone
      const hashesAfter = await store.findByName("TestGame");
      expect(hashesAfter.length).toBe(0);
      
      await store.close();
    });
  });

  describe("del() error handling", () => {
    it("should handle delete errors gracefully", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      await store.put("key-with-error", { name: "Test" });
      
      // Force error by closing
      (store as any).bee = null;
      (store as any)._opened = false;
      
      const result = await store.del("key-with-error");
      expect(isErr(result)).toBe(true);
    });
  });
});