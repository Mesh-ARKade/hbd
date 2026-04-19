import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import * as fs from "node:fs";
import { isOk, isErr } from "../src/core/result.js";
import { StorageError, StorageNotOpenedError, StorageOperationError } from "../src/storage/errors.js";

// Use a unique temp directory per test
const getUniqueDir = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("Storage Errors - Result-based", () => {
  let testDir: string;
  let store: ReturnType<typeof createMetadataStore>;

  beforeEach(async () => {
    testDir = getUniqueDir(".hbd-err");
    store = createMetadataStore(testDir);
    await store.open();
  });

  afterEach(async () => {
    await store.close();
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("store not opened errors", () => {
    it("should return error when put without open", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      const result = await closedStore.put("key", {});
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(StorageNotOpenedError);
    });

    it("should throw when get without open (backwards compat)", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      await expect(closedStore.get("key")).rejects.toThrow("Store not opened");
    });

    it("should return error when del without open", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      const result = await closedStore.del("key");
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(StorageNotOpenedError);
    });

    it("should throw when entries without open", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      const iterator = closedStore.entries();
      await expect(iterator.next()).rejects.toThrow("Store not opened");
    });
  });

  describe("error classes", () => {
    it("StorageError", () => {
      const e = new StorageError("test");
      expect(e.message).toBe("test");
      expect(e.name).toBe("StorageError");
    });

    it("StorageNotOpenedError", () => {
      const e = new StorageNotOpenedError();
      expect(e.message).toBe("Store not opened");
      expect(e.name).toBe("StorageNotOpenedError");
    });

    it("StorageNotOpenedError with custom message", () => {
      const e = new StorageNotOpenedError("custom");
      expect(e.message).toBe("custom");
    });

    it("StorageOperationError", () => {
      const e = new StorageOperationError("op failed");
      expect(e.message).toBe("op failed");
      expect(e.name).toBe("StorageOperationError");
    });
  });

  describe("index collision handling", () => {
    it("should handle adding same hash to name index twice", async () => {
      await store.put("sha1:same", { name: "Collision", system: "NES" });
      await store.put("sha1:same", { name: "Collision", system: "NES" });
      
      const hashes = await store.findByName("Collision");
      expect(hashes.length).toBe(1);
    });
  });
});