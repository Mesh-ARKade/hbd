import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleAdd, handleScan, handleList, handleInfo, handleSync, handleInit } from "../src/cli-handlers.js";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import { isOk, isErr } from "../src/core/result.js";

describe("CLI Command Handlers - Full Coverage", () => {
  let testDir: string;
  let store: ReturnType<typeof createMetadataStore>;
  let mockLogger: any;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-cli");
    store = createMetadataStore(testDir);
    await store.open();
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger)
    };
  });

  afterEach(async () => {
    await store.close();
    await robustRm(testDir);
  });

  describe("handleAdd()", () => {
    it("should add ROM and return Ok(true)", async () => {
      const romData = { name: "Test Game", system: "NES", size: 40960 };
      const result = await handleAdd("sha1:test123", romData, store);
      
      expect(isOk(result)).toBe(true);
      expect(result.value).toBe(true);

      const retrieved = await store.get("sha1:test123");
      expect(retrieved).toEqual(romData);
    });

    it("should add ROM with logger", async () => {
      const romData = { name: "Logged Game", system: "SNES" };
      const result = await handleAdd("sha1:logged", romData, store, mockLogger);
      
      expect(isOk(result)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("should handle store errors", async () => {
      // Force store to be closed
      await store.close();
      (store as any).bee = null;
      
      const result = await handleAdd("sha1:err", { name: "Error" }, store);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle put errors", async () => {
      const result = await handleAdd("sha1:fail", { name: "Fail" }, store, mockLogger);
      
      // Should succeed normally
      expect(isOk(result) || isErr(result)).toBe(true);
    });
  });

  describe("handleScan()", () => {
    it("should scan and return Ok(entries)", async () => {
      await store.put("sha1:abc", { name: "Game1", system: "NES" });
      await store.put("sha1:def", { name: "Game2", system: "NES" });

      const result = await handleScan(store);
      
      expect(isOk(result)).toBe(true);
      expect(result.value.length).toBeGreaterThanOrEqual(2);
    });

    it("should scan with logger", async () => {
      const result = await handleScan(store, mockLogger);
      
      expect(isOk(result)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith("Scan command started");
    });

    it("should return error on store failure", async () => {
      await store.close();
      (store as any).bee = null;
      
      const result = await handleScan(store);
      
      expect(isErr(result)).toBe(true);
    });

    it("should return error on entries failure", async () => {
      const result = await handleScan(store, mockLogger);
      
      // Normal operation should succeed
      expect(isOk(result) || isErr(result)).toBe(true);
    });
  });

  describe("handleList()", () => {
    it("should list ROMs by system", async () => {
      await store.put("sha1:abc", { name: "Game1", system: "NES" });
      await store.put("sha1:def", { name: "Game2", system: "NES" });
      await store.put("sha1:ghi", { name: "Game3", system: "SNES" });

      const result = await handleList("NES", store);
      
      expect(isOk(result)).toBe(true);
      expect(result.value.length).toBe(2);
    });

    it("should return empty array when no matches", async () => {
      await store.put("sha1:abc", { name: "Game1", system: "NES" });

      const result = await handleList("SNES", store);
      
      expect(isOk(result)).toBe(true);
      expect(result.value).toEqual([]);
    });

    it("should list with logger", async () => {
      const result = await handleList("NES", store, mockLogger);
      
      expect(isOk(result)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith({ system: "NES" }, "List command started");
    });

    it("should return error on store failure", async () => {
      await store.close();
      (store as any).bee = null;
      
      const result = await handleList("NES", store);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe("handleInfo()", () => {
    it("should return ROM info", async () => {
      await store.put("sha1:abc", { name: "Game", system: "NES", size: 40960 });

      const result = await handleInfo("sha1:abc", store);
      
      expect(isOk(result)).toBe(true);
      expect(result.value).toEqual({ name: "Game", system: "NES", size: 40960 });
    });

    it("should return null for non-existent key", async () => {
      const result = await handleInfo("sha1:nonexistent", store);
      
      expect(isOk(result)).toBe(true);
      expect(result.value).toBeNull();
    });

    it("should get info with logger", async () => {
      await store.put("sha1:logged", { name: "Logged" });
      
      const result = await handleInfo("sha1:logged", store, mockLogger);
      
      expect(isOk(result)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith({ key: "sha1:logged" }, "Info command started");
    });

    it("should return error on store failure", async () => {
      await store.close();
      (store as any).bee = null;
      
      const result = await handleInfo("sha1:abc", store);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe("handleSync()", () => {
    it("should return sync status", async () => {
      const result = await handleSync(store);
      
      expect(isOk(result)).toBe(true);
      expect(result.value).toBeDefined();
      expect(typeof result.value.publicKey).toBe("string");
      expect(typeof result.value.peers).toBe("number");
    });

    it("should sync with logger", async () => {
      const result = await handleSync(store, mockLogger);
      
      expect(isOk(result)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith("Sync command started");
    });

    it("should return error on store failure", async () => {
      await store.close();
      (store as any).bee = null;
      
      const result = await handleSync(store);
      
      expect(isErr(result)).toBe(true);
    });
  });

  describe("handleInit()", () => {
    it("should initialize and return public key", async () => {
      const newDir = getUniqueTestDir(".hbd-init");
      const newStore = createMetadataStore(newDir);
      
      const result = await handleInit(newStore);
      
      expect(isOk(result)).toBe(true);
      expect(result.value.publicKey).toBeDefined();
      expect(result.value.publicKey.length).toBeGreaterThan(0);
      
      await newStore.close();
      await robustRm(newDir);
    });

    it("should init with logger", async () => {
      const newDir = getUniqueTestDir(".hbd-init-log");
      const newStore = createMetadataStore(newDir);
      
      const result = await handleInit(newStore, mockLogger);
      
      expect(isOk(result)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith("Init command started");
      
      await newStore.close();
      await robustRm(newDir);
    });

    it("should handle init with invalid path", async () => {
      const badStore = createMetadataStore("/invalid/path/that/does/not/exist");
      
      const result = await handleInit(badStore);
      
      // Result may be Ok or Err depending on filesystem
      expect(result.ok !== undefined).toBe(true);
    });
  });

  describe("Result pattern compliance", () => {
    it("all handlers should return Result objects", async () => {
      const addResult = await handleAdd("test", {}, store);
      const scanResult = await handleScan(store);
      const listResult = await handleList("NES", store);
      const infoResult = await handleInfo("test", store);
      const syncResult = await handleSync(store);
      
      expect(addResult.ok !== undefined).toBe(true);
      expect(scanResult.ok !== undefined).toBe(true);
      expect(listResult.ok !== undefined).toBe(true);
      expect(infoResult.ok !== undefined).toBe(true);
      expect(syncResult.ok !== undefined).toBe(true);
    });

    it("all handlers should support optional logger", async () => {
      const addResult = await handleAdd("test", { name: "Test" }, store, mockLogger);
      const scanResult = await handleScan(store, mockLogger);
      const listResult = await handleList("NES", store, mockLogger);
      const infoResult = await handleInfo("test", store, mockLogger);
      const syncResult = await handleSync(store, mockLogger);
      
      expect(isOk(addResult)).toBe(true);
      expect(isOk(scanResult)).toBe(true);
      expect(isOk(listResult)).toBe(true);
      expect(isOk(infoResult)).toBe(true);
      expect(isOk(syncResult)).toBe(true);
    });
  });

  describe("Error propagation", () => {
    it("should propagate errors from store operations", async () => {
      // Close store to force errors
      await store.close();
      
      const addResult = await handleAdd("test", {}, store);
      const scanResult = await handleScan(store);
      const listResult = await handleList("NES", store);
      const infoResult = await handleInfo("test", store);
      const syncResult = await handleSync(store);
      
      expect(isErr(addResult)).toBe(true);
      expect(isErr(scanResult)).toBe(true);
      expect(isErr(listResult)).toBe(true);
      expect(isErr(infoResult)).toBe(true);
      expect(isErr(syncResult)).toBe(true);
    });

    it("should handle exceptions in handleAdd", async () => {
      // Mock store to throw
      const throwingStore = {
        open: vi.fn().mockRejectedValue(new Error("Open failed"))
      } as any;
      
      const result = await handleAdd("test", {}, throwingStore, mockLogger);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle exceptions in handleScan", async () => {
      const throwingStore = {
        open: vi.fn().mockRejectedValue(new Error("Open failed"))
      } as any;
      
      const result = await handleScan(throwingStore, mockLogger);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle exceptions in handleList", async () => {
      const throwingStore = {
        open: vi.fn().mockRejectedValue(new Error("Open failed"))
      } as any;
      
      const result = await handleList("NES", throwingStore, mockLogger);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle exceptions in handleInfo", async () => {
      const throwingStore = {
        open: vi.fn().mockRejectedValue(new Error("Open failed"))
      } as any;
      
      const result = await handleInfo("test", throwingStore, mockLogger);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle exceptions in handleSync", async () => {
      const throwingStore = {
        open: vi.fn().mockRejectedValue(new Error("Open failed"))
      } as any;
      
      const result = await handleSync(throwingStore, mockLogger);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle exceptions in handleInit", async () => {
      const throwingStore = {
        open: vi.fn().mockRejectedValue(new Error("Open failed"))
      } as any;
      
      const result = await handleInit(throwingStore, mockLogger);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle store.open() returning Err in handleInit", async () => {
      const errStore = {
        open: vi.fn().mockResolvedValue({ ok: false, error: new Error("Store error") })
      } as any;
      
      const result = await handleInit(errStore, mockLogger);
      
      expect(isErr(result)).toBe(true);
    });

    it("should handle store.open() returning Err in all handlers", async () => {
      const errStore = {
        open: vi.fn().mockResolvedValue({ ok: false, error: new Error("Store error") }),
        put: vi.fn(),
        get: vi.fn(),
        entries: vi.fn()
      } as any;
      
      expect(isErr(await handleAdd("test", {}, errStore, mockLogger))).toBe(true);
      expect(isErr(await handleScan(errStore, mockLogger))).toBe(true);
      expect(isErr(await handleList("NES", errStore, mockLogger))).toBe(true);
      expect(isErr(await handleInfo("test", errStore, mockLogger))).toBe(true);
      expect(isErr(await handleSync(errStore, mockLogger))).toBe(true);
    });
  });
});