import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";

describe("IndexedMetadataStore - Master Record Merge", () => {
  let testDir: string;
  let store: ReturnType<typeof createMetadataStore>;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-merge");
    store = createMetadataStore(testDir);
    await store.open();
  });

  afterEach(async () => {
    await store.close();
    await robustRm(testDir);
  });

  describe("merge sources array", () => {
    it("should merge sources when putting to existing key", async () => {
      await store.put("sha1:abc123", { 
        name: "Game", 
        system: "NES",
        sources: ["no-intro"]
      });

      await store.put("sha1:abc123", { 
        name: "Game", 
        system: "NES",
        sources: ["mame"]
      });

      const result = await store.get("sha1:abc123") as { sources?: string[] };
      expect(result.sources).toContain("no-intro");
      expect(result.sources).toContain("mame");
    });

    it("should deduplicate sources", async () => {
      await store.put("sha1:abc123", { name: "Game", system: "NES", sources: ["no-intro", "redump"] });
      await store.put("sha1:abc123", { name: "Game", system: "NES", sources: ["redump", "tosec"] });

      const result = await store.get("sha1:abc123") as { sources?: string[] };
      const uniqueSources = [...new Set(result.sources ?? [])];
      expect(uniqueSources).toContain("no-intro");
      expect(uniqueSources).toContain("redump");
      expect(uniqueSources).toContain("tosec");
      expect(uniqueSources.length).toBe(3);
    });

    it("should merge metadata - fill missing CRC32", async () => {
      await store.put("sha1:abc123", { name: "Game", system: "NES", crc32: "deadbeef" });
      await store.put("sha1:abc123", { name: "Game", system: "NES" });

      const result = await store.get("sha1:abc123") as { crc32?: string };
      expect(result.crc32).toBe("deadbeef");
    });

    it("should merge metadata - prefer enriched data", async () => {
      await store.put("sha1:abc123", { name: "Game", system: "NES" });
      await store.put("sha1:abc123", { name: "Game", system: "NES", genre: "Platformer", year: 1985 });

      const result = await store.get("sha1:abc123") as { genre?: string; year?: number };
      expect(result.genre).toBe("Platformer");
      expect(result.year).toBe(1985);
    });
  });

  describe("new key - no merge needed", () => {
    it("should just store normally for new keys", async () => {
      await store.put("sha1:newkey", { name: "New Game", system: "NES" });

      const result = await store.get("sha1:newkey");
      expect(result).toEqual({ name: "New Game", system: "NES" });
    });
  });
});