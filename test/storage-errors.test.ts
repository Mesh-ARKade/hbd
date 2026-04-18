import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import * as fs from "node:fs";

// Use a unique temp directory per test
const getUniqueDir = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("IndexedMetadataStore - Error Handling", () => {
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
    it("should throw when put without open", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      await expect(closedStore.put("key", {})).rejects.toThrow("Store not opened");
    });

    it("should throw when get without open", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      await expect(closedStore.get("key")).rejects.toThrow("Store not opened");
    });

    it("should throw when del without open", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      await expect(closedStore.del("key")).rejects.toThrow("Store not opened");
    });

    it("should throw when entries without open", async () => {
      const closedStore = createMetadataStore(getUniqueDir(".hbd-closed"));
      const iterator = closedStore.entries();
      await expect(iterator.next()).rejects.toThrow("Store not opened");
    });
  });

  describe("index collision handling", () => {
    it("should handle adding same hash to name index twice", async () => {
      // Same hash, same name
      await store.put("sha1:same", { name: "Collision", system: "NES" });
      // Put again - should not duplicate
      await store.put("sha1:same", { name: "Collision", system: "NES" });
      
      const hashes = await store.findByName("Collision");
      expect(hashes.length).toBe(1);
    });
  });
});