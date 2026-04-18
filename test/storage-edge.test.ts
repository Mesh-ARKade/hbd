import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import * as fs from "node:fs";

const getUniqueDir = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("IndexedMetadataStore - Edge Cases", () => {
  let testDir: string;
  let store: ReturnType<typeof createMetadataStore>;

  beforeEach(async () => {
    testDir = getUniqueDir(".hbd-edge");
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

  describe("findByName edge cases", () => {
    it("should return empty if index entry is malformed", async () => {
      // Directly put a malformed index entry
      await store.put("idx:name!malformed", { notHashes: "invalid" });
      
      const hashes = await store.findByName("malformed");
      expect(hashes).toEqual([]);
    });
  });

  describe("findByCrc32 edge cases", () => {
    it("should return empty if index entry is malformed", async () => {
      await store.put("idx:crc32!badcrc", { wrongField: 123 });
      
      const hashes = await store.findByCrc32("badcrc");
      expect(hashes).toEqual([]);
    });
  });

  describe("removeFromNameIndex edge case - hash not in list", async () => {
    it("should not modify index if hash not in list", async () => {
      await store.put("sha1:existing", { name: "Game", system: "NES" });
      // Try to remove a hash that doesn't exist
      await store.del("sha1:nonexistent");
      
      // Game should still be findable
      const hashes = await store.findByName("Game");
      expect(hashes).toContain("sha1:existing");
    });
  });
});