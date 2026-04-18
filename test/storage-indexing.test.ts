import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";

describe("IndexedMetadataStore - Secondary Indexing", () => {
  let testDir: string;
  let store: ReturnType<typeof createMetadataStore>;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-idx");
    store = createMetadataStore(testDir);
    await store.open();
  });

  afterEach(async () => {
    await store.close();
    await robustRm(testDir);
  });

  describe("secondary index by name", () => {
    it("should index ROM by name", async () => {
      await store.put("sha1:abc123", { name: "Super Mario Bros.", system: "NES" });
      
      const normalizedName = store.normalizeName("Super Mario Bros.");
      const byName = await store.get(`idx:name!${normalizedName}`);
      expect(byName).toBeDefined();
    });

    it("should handle multiple ROMs with same name", async () => {
      await store.put("sha1:aaa111", { name: "Mario Bros.", system: "NES" });
      await store.put("sha1:bbb222", { name: "Mario Bros.", system: "NES" });
      
      const normalizedName = store.normalizeName("Mario Bros.");
      const entries = await store.get(`idx:name!${normalizedName}`);
      expect(entries).toBeDefined();
    });
  });

  describe("secondary index by CRC32", () => {
    it("should index ROM by CRC32", async () => {
      const crc32 = "1a2b3c4d";
      await store.put("sha1:abc123", { name: "Game", system: "NES", crc32 });
      
      const byCrc = await store.get(`idx:crc32!${crc32}`);
      expect(byCrc).toBeDefined();
    });

    it("should find by CRC32 efficiently", async () => {
      const crc32 = "deadbeef";
      await store.put("sha1:hash1", { name: "Game1", system: "NES", crc32 });
      await store.put("sha1:hash2", { name: "Game2", system: "NES", crc32: "cafebabe" });
      await store.put("sha1:hash3", { name: "Game3", system: "NES", crc32: "deadbeef" });
      
      const results = await store.get("idx:crc32!deadbeef");
      expect(results).toBeDefined();
    });
  });

  describe("normalizeName()", () => {
    it("should normalize ROM names for consistent indexing", () => {
      const n1 = store.normalizeName("Super Mario Bros.");
      const n2 = store.normalizeName("SUPER MARIO BROS.");
      const n3 = store.normalizeName("super mario bros.");
      
      expect(n1).toBe(n2);
      expect(n2).toBe(n3);
    });

    it("should remove special chars", () => {
      const n = store.normalizeName("Sonic / Hedgehog!");
      expect(n).toBe("sonichedgehog");
    });
  });

  describe("findByName() - secondary lookup", () => {
    it("should find hashes by normalized name", async () => {
      await store.put("sha1:abc123", { name: "Super Mario Bros.", system: "NES" });
      
      const hashes = await store.findByName("Super Mario Bros.");
      expect(hashes).toContain("sha1:abc123");
    });

    it("should find multiple hashes for same name", async () => {
      await store.put("sha1:aaa111", { name: "Same Game", system: "NES" });
      await store.put("sha1:bbb222", { name: "Same Game", system: "NES" });
      
      const hashes = await store.findByName("Same Game");
      expect(hashes.length).toBe(2);
    });

    it("should return empty array for non-existent name", async () => {
      const hashes = await store.findByName("Non Existent Game");
      expect(hashes).toEqual([]);
    });
  });

  describe("findByCrc32() - secondary lookup", () => {
    it("should find hashes by CRC32", async () => {
      await store.put("sha1:abc123", { name: "Game", system: "NES", crc32: "deadbeef" });
      
      const hashes = await store.findByCrc32("deadbeef");
      expect(hashes).toContain("sha1:abc123");
    });

    it("should find multiple hashes for same CRC32", async () => {
      await store.put("sha1:aaa111", { name: "Game1", system: "NES", crc32: "cafebabe" });
      await store.put("sha1:bbb222", { name: "Game2", system: "NES", crc32: "cafebabe" });
      
      const hashes = await store.findByCrc32("cafebabe");
      expect(hashes.length).toBe(2);
    });

    it("should return empty array for non-existent CRC32", async () => {
      const hashes = await store.findByCrc32("notrealcrc");
      expect(hashes).toEqual([]);
    });
  });

  describe("del() - cleanup indexes", () => {
    it("should remove from name index on delete", async () => {
      await store.put("sha1:abc123", { name: "ToDelete", system: "NES" });
      await store.del("sha1:abc123");
      
      const hashes = await store.findByName("ToDelete");
      expect(hashes).toEqual([]);
    });

    it("should remove from CRC32 index on delete", async () => {
      await store.put("sha1:abc123", { name: "Game", system: "NES", crc32: "baddcafe" });
      await store.del("sha1:abc123");
      
      const hashes = await store.findByCrc32("baddcafe");
      expect(hashes).toEqual([]);
    });

    it("should handle deleting non-indexed entry gracefully", async () => {
      await store.put("sha1:orphan", { name: "Orphan", system: "NES" });
      await store.del("sha1:orphan");
    });
  });
});