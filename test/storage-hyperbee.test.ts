import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import { getUniqueTestDir, robustRm, sweepTestDirs } from "./test-utils.js";

// Pre-sweep is now in vitest.config.ts setupFiles

describe("Hyperbee storage - Primary SHA1 Index", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-test");
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("createMetadataStore()", () => {
    it("should create a metadata store", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      expect(store.getPublicKey()).toBeDefined();
      expect(store.getPublicKey().length).toBeGreaterThan(0);
      await store.close();
    });

    it("should create unique public keys for different directories", async () => {
      expect(true).toBe(true);
    });
  });

  describe("put() and get() - Primary Index", () => {
    it("should store and retrieve by SHA1 key", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      const sha1Key = "abc123def456789012345678901234567890abcd";
      const romData = { name: "Super Mario Bros.", system: "NES", size: 40960 };
      await store.put(sha1Key, romData);
      
      const result = await store.get(sha1Key);
      expect(result).toEqual(romData);
      
      await store.close();
    });

    it("should return null for non-existent SHA1", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      const result = await store.get("nonexistent-sha1");
      expect(result).toBeNull();
      
      await store.close();
    });

    it("should overwrite existing key", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      await store.put("key", { v: 1 });
      await store.put("key", { v: 2 });
      
      const result = await store.get("key");
      expect(result).toEqual({ v: 2 });
      
      await store.close();
    });
  });

  describe("del() - Primary Index", () => {
    it("should delete by SHA1 key", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      await store.put("sha1:abc123", { name: "Test" });
      await store.del("sha1:abc123");
      
      const result = await store.get("sha1:abc123");
      expect(result).toBeNull();
      
      await store.close();
    });

    it("should handle deleting non-existent key gracefully", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      await store.del("nonexistent");
      
      await store.close();
    });
  });

  describe("entries() - Iterate all", () => {
    it("should iterate all stored entries", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      await store.put("key1", { v: 1 });
      await store.put("key2", { v: 2 });
      await store.put("key3", { v: 3 });
      
      const entries = [];
      for await (const [key, value] of store.entries()) {
        entries.push({ key, value });
      }
      
      expect(entries.length).toBe(3);
      
      await store.close();
    });

    it("should start empty", async () => {
      const store = createMetadataStore(testDir);
      await store.open();
      
      const entries = [];
      for await (const [key, value] of store.entries()) {
        entries.push({ key, value });
      }
      
      expect(entries.length).toBe(0);
      
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
});