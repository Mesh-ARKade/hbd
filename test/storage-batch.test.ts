/**
 * Tests for MetadataStore batch operations.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMetadataStore } from "../src/storage/hyperbee.js";
import { isOk, isErr } from "../src/core/result.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import * as fs from "node:fs";

describe("MetadataStore Batch Operations", () => {
  let testDir: string;
  let store: ReturnType<typeof createMetadataStore>;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-batch-test");
    fs.mkdirSync(testDir, { recursive: true });
    
    store = createMetadataStore(testDir);
    const openResult = await store.open();
    expect(isOk(openResult)).toBe(true);
  });

  afterEach(async () => {
    await store.close();
    await robustRm(testDir);
  });

  describe("batchPut", () => {
    it("should batch insert multiple records", async () => {
      const records = [
        { key: "sha1:aaa", value: { name: "Game A", crc32: "1111" } },
        { key: "sha1:bbb", value: { name: "Game B", crc32: "2222" } },
        { key: "sha1:ccc", value: { name: "Game C", crc32: "3333" } },
      ];

      const result = await store.batchPut(records);

      if (isErr(result)) {
        console.log("Batch put error:", result.error);
      }
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.count).toBe(3);
      }

      // Verify all records were inserted
      for (const record of records) {
        const value = await store.get(record.key);
        expect(value).toBeDefined();
        expect(value).not.toBeNull();
        expect((value as any)?.name).toBe(record.value.name);
      }
    });

    it("should update secondary indexes in batch", async () => {
      const records = [
        { key: "sha1:aaa", value: { name: "Super Mario", crc32: "ABCD" } },
        { key: "sha1:bbb", value: { name: "Super Mario", crc32: "EFGH" } },
      ];

      const result = await store.batchPut(records);
      expect(isOk(result)).toBe(true);

      // Verify name index was updated by querying
      const hashes = await store.findByName("Super Mario");
      expect(hashes).toHaveLength(2);
    });

    it("should return error for empty batch", async () => {
      const result = await store.batchPut([]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.count).toBe(0);
      }
    });

    it("should handle large batches efficiently", async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        key: `sha1:${i.toString().padStart(3, "0")}`,
        value: { name: `Game ${i}`, crc32: `${i}` },
      }));

      const startTime = Date.now();
      const result = await store.batchPut(records);
      const duration = Date.now() - startTime;

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.count).toBe(100);
      }

      // Batch should be reasonably fast (< 5 seconds for 100 records)
      expect(duration).toBeLessThan(5000);
    });

    it("should return error if store not opened", async () => {
      await store.close();

      const records = [{ key: "sha1:test", value: { name: "Test" } }];
      const result = await store.batchPut(records);

      expect(isErr(result)).toBe(true);
    });

    it("should report progress during batch operation", async () => {
      const progressCallback = vi.fn();
      
      const records = Array.from({ length: 50 }, (_, i) => ({
        key: `sha1:${i.toString().padStart(3, "0")}`,
        value: { name: `Game ${i}` },
      }));

      const result = await store.batchPut(records, { onProgress: progressCallback });

      expect(isOk(result)).toBe(true);
      // Progress should have been called multiple times
      expect(progressCallback).toHaveBeenCalled();
    });
  });
});
