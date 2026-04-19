import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import * as fs from "node:fs";
import { isOk, isErr } from "../src/core/result.js";
import { StorageOpenError } from "../src/storage/hyperbee.js";

const getUniqueDir = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("Storage Final Coverage Tests", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = getUniqueDir(".hbd-final");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe("secondary index cleanup", () => {
    it("should update name index when one of multiple hashes removed", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      // Add TWO ROMs with same name
      await store.put("sha1:rom1", { name: "SameName", system: "NES" });
      await store.put("sha1:rom2", { name: "SameName", system: "SNES" });
      
      // Verify both in index
      const hashesBefore = await store.findByName("SameName");
      expect(hashesBefore.length).toBe(2);
      
      // Delete ONE
      await store.del("sha1:rom1");
      
      // Index should be updated (not deleted)
      const hashesAfter = await store.findByName("SameName");
      expect(hashesAfter.length).toBe(1);
      expect(hashesAfter[0]).toBe("sha1:rom2");
      
      await store.close();
    });

    it("should cleanup crc32 index on delete", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      await store.put("sha1:abc", { name: "Test", crc32: "deadbeef", system: "NES" });
      
      const crcBefore = await store.findByCrc32("deadbeef");
      expect(crcBefore.length).toBe(1);
      
      await store.del("sha1:abc");
      
      const crcAfter = await store.findByCrc32("deadbeef");
      expect(crcAfter.length).toBe(0);
      
      await store.close();
    });

    it("should update crc32 index when one hash removed", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      await store.put("sha1:rom1", { name: "Game1", crc32: "aabbccdd" });
      await store.put("sha1:rom2", { name: "Game2", crc32: "aabbccdd" });
      
      await store.del("sha1:rom1");
      
      const hashes = await store.findByCrc32("aabbccdd");
      expect(hashes.length).toBe(1);
      
      await store.close();
    });
  });

  describe("error paths", () => {
    it("should handle put errors when store not opened", async () => {
      const store = createMetadataStore(testDir);
      const result = await store.put("key", { name: "Test" });
      expect(isErr(result)).toBe(true);
    });

    it("should handle del errors when store not opened", async () => {
      const store = createMetadataStore(testDir);
      const result = await store.del("key");
      expect(isErr(result)).toBe(true);
    });

    it("should handle get errors gracefully", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      const { createLogger } = await import("../src/core/logger.js");
      store.setLogger(createLogger({ level: "debug" }));
      
      (store as any).bee = null;
      await expect(store.get("key")).rejects.toThrow();
    });

    it("should handle entries error when not opened", async () => {
      const store = createMetadataStore(testDir);
      const iterator = store.entries();
      await expect(iterator.next()).rejects.toThrow("Store not opened");
    });
  });

  describe("normalizeName edge cases", () => {
    it("should normalize various names", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      expect(store.normalizeName("Super Mario Bros.")).toBe("supermariobros");
      expect(store.normalizeName("  Spaces  ")).toBe("spaces");
      expect(store.normalizeName("Special!@#Chars")).toBe("specialchars");
      expect(store.normalizeName("MiXeD CaSe")).toBe("mixedcase");
      
      await store.close();
    });
  });
});