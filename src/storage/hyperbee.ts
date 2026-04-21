/**
 * Hyperbee storage layer for ROM metadata using the Hyperstack.
 * Refactored to use Result pattern and Pino logging.
 * @packageDocumentation
 */

import Hyperbee from "hyperbee";
import Hypercore from "hypercore";
import * as fs from "node:fs";
import { ok, err, Result, isErr } from "../core/result.js";
import { StorageError, StorageNotOpenedError, StorageOperationError } from "./errors.js";
import { Logger, pino } from "pino";

/**
 * Index entry interface for secondary indexes.
 */
interface IndexEntry {
  hashes: string[];
}

/**
 * Custom error class for storage operations
 */
export class StorageOpenError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "StorageOpenError";
  }
}

export class StoragePutError extends Error {
  constructor(message: string, public readonly key: string) {
    super(message);
    this.name = "StoragePutError";
  }
}

export class StorageGetError extends Error {
  constructor(message: string, public readonly key: string) {
    super(message);
    this.name = "StorageGetError";
  }
}

export class StorageDelError extends Error {
  constructor(message: string, public readonly key: string) {
    super(message);
    this.name = "StorageDelError";
  }
}

/**
 * Hyperbee storage layer with file-based persistence and secondary indexing.
 */
export class MetadataStore {
  private core: Hypercore | null = null;
  private bee: Hyperbee | null = null;
  private opened: boolean = false;
  private _publicKey: string = "";
  private _dataDir: string;
  private logger: Logger | null = null;

  constructor(dataDir?: string) {
    this._dataDir = dataDir ?? ".hbd-data";
  }

  /**
   * Set a logger instance for observability
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Internal logging helper
   */
  private log(level: string, message: string, meta: Record<string, unknown> = {}): void {
    if (this.logger) {
      // Use switch to avoid union type issues with dynamic key access
      switch (level) {
        case "error":
          this.logger.error({ system: "storage", sha1: this._publicKey, dataDir: this._dataDir, ...meta }, message);
          break;
        case "warn":
          this.logger.warn({ system: "storage", sha1: this._publicKey, dataDir: this._dataDir, ...meta }, message);
          break;
        case "info":
          this.logger.info({ system: "storage", sha1: this._publicKey, dataDir: this._dataDir, ...meta }, message);
          break;
        case "debug":
          this.logger.debug({ system: "storage", sha1: this._publicKey, dataDir: this._dataDir, ...meta }, message);
          break;
        case "trace":
          this.logger.trace({ system: "storage", sha1: this._publicKey, dataDir: this._dataDir, ...meta }, message);
          break;
      }
    }
  }

  /**
   * Set the data directory.
   */
  setDataDir(dir: string): void {
    this._dataDir = dir;
  }

  /**
   * Get the data directory.
   */
  getDataDir(): string {
    return this._dataDir;
  }

  /**
   * Get the public key (Hypercore key).
   */
  getPublicKey(): string {
    return this._publicKey;
  }

  /**
   * Normalize a ROM name for consistent indexing.
   */
  normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  /**
   * Open the store with file-based persistence.
   * REQUIRES a public key. Random generation is forbidden.
   * @param publicKey - Hex string of the public key to use
   */
  async open(publicKey?: string, secretKey?: string): Promise<Result<string, StorageOpenError>> {
    try {
      if (this.opened) {
        return ok(this._publicKey);
      }

      // Identity Guardrail: Vault key is REQUIRED
      if (!publicKey && !this._publicKey) {
        return err(
          new StorageOpenError(
            "Identity not initialized. Please provide a public key or run 'hbd init' first."
          )
        );
      }

      // Vault Architecture: Secret key is required for write access
      if (!secretKey) {
        return err(
          new StorageOpenError(
            "UnauthorizedCurator: Vault key required. Please authenticate with GitHub and fetch your writer key."
          )
        );
      }

      const keyToUse = publicKey || this._publicKey;
      this.log("info", "Opening storage with vault key", { dataDir: this._dataDir, publicKey: keyToUse });

      // Ensure directory exists
      if (!fs.existsSync(this._dataDir)) {
        fs.mkdirSync(this._dataDir, { recursive: true });
      }

      // Create Hypercore with file storage and explicit key pair
      const keyPair = {
        publicKey: Buffer.from(keyToUse, "hex"),
        secretKey: Buffer.from(secretKey, "hex"),
      };
      this.core = new Hypercore(this._dataDir, keyPair);
      await this.core.ready();

      // Verify the key matches
      if (this.core.key.toString("hex") !== keyToUse) {
         return err(new StorageOpenError("Critical Identity Mismatch: Hypercore key does not match provided identity."));
      }

      // Create Hyperbee on top of Hypercore
      this.bee = new Hyperbee(this.core, {
        keyEncoding: "utf8",
        valueEncoding: "json",
      });
      await this.bee.ready();

      this._publicKey = keyToUse;
      this.opened = true;

      this.log("info", "Storage opened with vault authentication", { publicKey: this._publicKey });

      return ok(this._publicKey);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log("error", "Storage open failed", { error: errMsg });
      return err(new StorageOpenError(errMsg, error instanceof Error ? error : undefined));
    }
  }

  /**
   * Close the store.
   */
  async close(): Promise<Result<void, StorageError>> {
    try {
      this.log("info", "Closing storage", { publicKey: this._publicKey });
      
      this.opened = false;
      this.core = null;
      this.bee = null;
      this._publicKey = "";
      
      return ok(undefined);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return err(new StorageError(errMsg));
    }
  }

  /**
   * Put a value with automatic secondary index updates and merge handling.
   */
  async put(key: string, value: unknown): Promise<Result<void, StorageNotOpenedError | StoragePutError>> {
    if (!this.bee) {
      return err(new StorageNotOpenedError());
    }

    try {
      this.log("debug", "Putting record", { key, hasValue: !!value });

      const incoming = value as Record<string, unknown>;

      // Check for existing record - if so, merge
      const existing = await this.bee.get(key);
      const existingData = existing?.value as Record<string, unknown> | undefined;

      let mergedData: Record<string, unknown>;
      if (existingData) {
        mergedData = this.mergeRecords(existingData, incoming);
        this.log("debug", "Merged with existing record", { key });
      } else {
        mergedData = { ...incoming };
      }

      // Put the merged primary record
      await this.bee.put(key, mergedData);

      // Update name index if name exists
      if (mergedData.name && typeof mergedData.name === "string") {
        const normalizedName = this.normalizeName(mergedData.name);
        await this.updateNameIndex(normalizedName, key);
      }

      // Update CRC32 index if crc32 exists
      if (mergedData.crc32 && typeof mergedData.crc32 === "string") {
        await this.updateCrc32Index(mergedData.crc32, key);
      }

      this.log("info", "Record put", { key, sources: mergedData.sources });

      return ok(undefined);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log("error", "Put failed", { key, error: errMsg });
      return err(new StoragePutError(errMsg, key));
    }
  }

  /**
   * Merge two records - combines sources and fills missing fields.
   */
  private mergeRecords(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...existing };

    // Merge sources array
    const existingSources = (existing.sources as string[]) ?? [];
    const incomingSources = (incoming.sources as string[]) ?? [];
    if (incomingSources.length > 0) {
      const allSources = [...existingSources, ...incomingSources];
      result.sources = [...new Set(allSources)]; // Dedupe
    }

    // Merge other fields - prefer non-empty values from incoming
    for (const [key, value] of Object.entries(incoming)) {
      if (key === "sources") continue;
      if (value !== undefined && value !== null && value !== "") {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Update name secondary index.
   */
  private async updateNameIndex(normalizedName: string, hash: string): Promise<void> {
    const indexKey = `idx:name!${normalizedName}`;
    const existing = await this.bee!.get(indexKey);

    let entry: IndexEntry;
    if (existing?.value) {
      const existingEntry = existing.value as IndexEntry;
      if (!existingEntry.hashes.includes(hash)) {
        entry = { hashes: [...existingEntry.hashes, hash] };
      } else {
        entry = existingEntry;
      }
    } else {
      entry = { hashes: [hash] };
    }

    await this.bee!.put(indexKey, entry);
  }

  /**
   * Update CRC32 secondary index.
   */
  private async updateCrc32Index(crc32: string, hash: string): Promise<void> {
    const indexKey = `idx:crc32!${crc32}`;
    const existing = await this.bee!.get(indexKey);

    let entry: IndexEntry;
    if (existing?.value) {
      const existingEntry = existing.value as IndexEntry;
      if (!existingEntry.hashes.includes(hash)) {
        entry = { hashes: [...existingEntry.hashes, hash] };
      } else {
        entry = existingEntry;
      }
    } else {
      entry = { hashes: [hash] };
    }

    await this.bee!.put(indexKey, entry);
  }

  /**
   * Batch put multiple records efficiently.
   * Performs sequential puts with progress tracking.
   */
  async batchPut(
    records: Array<{ key: string; value: Record<string, unknown> }>,
    options?: { onProgress?: (processed: number, total: number) => void }
  ): Promise<Result<{ count: number }, StorageError>> {
    if (!this.opened || !this.bee) {
      this.log("error", "Batch put failed - store not opened");
      return err(new StorageNotOpenedError());
    }

    if (records.length === 0) {
      return ok({ count: 0 });
    }

    try {
      this.log("info", "Starting batch put", { count: records.length });

      let processed = 0;

      for (const record of records) {
        const result = await this.put(record.key, record.value);
        
        if (isErr(result)) {
          return err(new StoragePutError(result.error.message, record.key));
        }

        processed++;

        // Report progress
        if (options?.onProgress) {
          options.onProgress(processed, records.length);
        }
      }

      this.log("info", "Batch put complete", { count: processed });
      return ok({ count: processed });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log("error", "Batch put failed", { error: errMsg, count: records.length });
      return err(new StoragePutError(errMsg, "batch"));
    }
  }

  /**
   * Get a value by key (SHA1 primary lookup).
   */
  async get(key: string): Promise<unknown | null> {
    if (!this.bee) {
      throw new Error("Store not opened");
    }

    try {
      const result = await this.bee.get(key);
      return result?.value ?? null;
    } catch (error) {
      this.log("error", "Get failed", { key, error: String(error) });
      throw error;
    }
  }

  /**
   * Delete a key and its indexes.
   */
  async del(key: string): Promise<Result<void, StorageNotOpenedError | StorageDelError>> {
    if (!this.bee) {
      return err(new StorageNotOpenedError());
    }

    try {
      this.log("debug", "Deleting record", { key });

      const data = (await this.get(key)) as Record<string, unknown> | null;

      // Delete primary record
      await this.bee.del(key);

      // Remove from name index
      if (data?.name && typeof data.name === "string") {
        const normalizedName = this.normalizeName(data.name);
        await this.removeFromNameIndex(normalizedName, key);
      }

      // Remove from CRC32 index
      if (data?.crc32 && typeof data.crc32 === "string") {
        await this.removeFromCrc32Index(data.crc32, key);
      }

      this.log("info", "Record deleted", { key });

      return ok(undefined);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log("error", "Delete failed", { key, error: errMsg });
      return err(new StorageDelError(errMsg, key));
    }
  }

  /**
   * Remove hash from name index.
   */
  private async removeFromNameIndex(normalizedName: string, hash: string): Promise<void> {
    const indexKey = `idx:name!${normalizedName}`;
    const existing = await this.bee!.get(indexKey);

    if (existing?.value) {
      const entry = existing.value as IndexEntry;
      const hashes = entry.hashes.filter(h => h !== hash);

      if (hashes.length > 0) {
        await this.bee!.put(indexKey, { hashes });
      } else {
        await this.bee!.del(indexKey);
      }
    }
  }

  /**
   * Remove hash from CRC32 index.
   */
  private async removeFromCrc32Index(crc32: string, hash: string): Promise<void> {
    const indexKey = `idx:crc32!${crc32}`;
    const existing = await this.bee!.get(indexKey);

    if (existing?.value) {
      const entry = existing.value as IndexEntry;
      const hashes = entry.hashes.filter(h => h !== hash);

      if (hashes.length > 0) {
        await this.bee!.put(indexKey, { hashes });
      } else {
        await this.bee!.del(indexKey);
      }
    }
  }

  /**
   * Iterate all entries (for replication).
   */
  async *entries(): AsyncGenerator<[string, unknown]> {
    if (!this.bee) {
      throw new Error("Store not opened");
    }
    for await (const entry of this.bee.createReadStream()) {
      yield [entry.key, entry.value];
    }
  }

  /**
   * Find hashes by name (secondary lookup).
   */
  async findByName(name: string): Promise<string[]> {
    const normalizedName = this.normalizeName(name);
    const indexKey = `idx:name!${normalizedName}`;
    const result = await this.get(indexKey);

    if (result && typeof result === "object" && "hashes" in result) {
      return (result as IndexEntry).hashes;
    }
    return [];
  }

  /**
   * Find hashes by CRC32 (secondary lookup).
   */
  async findByCrc32(crc32: string): Promise<string[]> {
    const indexKey = `idx:crc32!${crc32}`;
    const result = await this.get(indexKey);

    if (result && typeof result === "object" && "hashes" in result) {
      return (result as IndexEntry).hashes;
    }
    return [];
  }
}

/**
 * Create a metadata store with optional data directory.
 */
export function createMetadataStore(dataDir?: string): MetadataStore {
  return new MetadataStore(dataDir);
}