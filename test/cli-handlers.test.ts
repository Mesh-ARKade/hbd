import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleAdd, handleScan, handleList, handleInfo, handleSync } from "../src/cli-handlers.js";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";

describe("CLI Command Handlers", () => {
  let testDir: string;
  let store: ReturnType<typeof createMetadataStore>;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-cli");
    store = createMetadataStore(testDir);
    await store.open();
  });

  afterEach(async () => {
    await store.close();
    await robustRm(testDir);
  });

  describe("handleAdd()", () => {
    it("should add ROM to store", async () => {
      const romData = { name: "Test Game", system: "NES", size: 40960 };
      const result = await handleAdd("sha1:test123", romData, store);
      expect(result).toBe(true);

      const retrieved = await store.get("sha1:test123");
      expect(retrieved).toEqual(romData);
    });

    it("should throw when store operation fails", async () => {
      const invalidData = {};
      const result = await handleAdd("sha1:err", invalidData, store);
      expect(result).toBe(true);
    });
  });

  describe("handleScan()", () => {
    it("should return all entries including indexes", async () => {
      await store.put("sha1:abc", { name: "Game1", system: "NES" });
      await store.put("sha1:def", { name: "Game2", system: "NES" });

      const results = await handleScan(store);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("handleList()", () => {
    it("should list ROMs by system", async () => {
      await store.put("sha1:abc", { name: "Game1", system: "NES" });
      await store.put("sha1:def", { name: "Game2", system: "NES" });
      await store.put("sha1:ghi", { name: "Game3", system: "SNES" });

      const nesGames = await handleList("NES", store);
      expect(nesGames.length).toBe(2);
    });
  });

  describe("handleInfo()", () => {
    it("should return info for SHA1 key", async () => {
      await store.put("sha1:abc", { name: "Game", system: "NES", size: 40960 });

      const info = await handleInfo("sha1:abc", store);
      expect(info).toEqual({ name: "Game", system: "NES", size: 40960 });
    });

    it("should return null for non-existent key", async () => {
      const info = await handleInfo("sha1:nonexistent", store);
      expect(info).toBeNull();
    });
  });

  describe("handleSync()", () => {
    it("should return sync status", async () => {
      const status = await handleSync(store);
      expect(status).toBeDefined();
      expect(typeof status).toBe("object");
    });
  });
});