/**
 * Hyperbee storage layer for ROM metadata using the Hyperstack.
 * @packageDocumentation
 */

import Hyperbee from "hyperbee";
import Hypercore from "hypercore";
import * as fs from "node:fs";

/**
 * Index entry interface for secondary indexes.
 */
interface IndexEntry {
  hashes: string[];
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

  constructor(dataDir?: string) {
    this._dataDir = dataDir ?? ".hbd-data";
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
   * - Lowercase
   * - Remove special characters
   * - Trim whitespace
   */
  normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  /**
   * Open the store with file-based persistence.
   */
  async open(): Promise<void> {
    if (this.opened) return;

    // Ensure directory exists
    if (!fs.existsSync(this._dataDir)) {
      fs.mkdirSync(this._dataDir, { recursive: true });
    }

    // Create Hypercore with file storage
    this.core = new Hypercore(this._dataDir);
    await this.core.ready();

    // Create Hyperbee on top of Hypercore
    this.bee = new Hyperbee(this.core, {
      keyEncoding: "utf8",
      valueEncoding: "json",
    });
    await this.bee.ready();

    // Get the public key from Hypercore
    this._publicKey = this.core.key.toString("hex");
    this.opened = true;
  }

  /**
   * Close the store.
   */
  async close(): Promise<void> {
    this.opened = false;
    this.core = null;
    this.bee = null;
  }

  /**
   * Put a value with automatic secondary index updates and merge handling.
   */
  async put(key: string, value: unknown): Promise<void> {
    if (!this.bee) throw new Error("Store not opened");

    const incoming = value as Record<string, unknown>;

    // Check for existing record - if so, merge
    const existing = await this.bee.get(key);
    const existingData = existing?.value as Record<string, unknown> | undefined;

    let mergedData: Record<string, unknown>;
    if (existingData) {
      // Merge the records
      mergedData = this.mergeRecords(existingData, incoming);
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
      if (key === "sources") continue; // Already handled
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
      // Merge with existing entries
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
   * Get a value by key (SHA1 primary lookup).
   */
  async get(key: string): Promise<unknown | null> {
    if (!this.bee) throw new Error("Store not opened");
    const result = await this.bee.get(key);
    return result?.value ?? null;
  }

  /**
   * Delete a key and its indexes.
   */
  async del(key: string): Promise<void> {
    if (!this.bee) throw new Error("Store not opened");

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
    if (!this.bee) throw new Error("Store not opened");
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