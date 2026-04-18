import { MetadataStore } from "./hyperbee.js";
import type { RomMetadata, DatSource } from "./schema.js";
/**
 * Indexable ROM metadata store.
 */
export declare class IndexedMetadataStore {
    private store;
    /**
     * Create a new indexed store.
     * @param dataDir - Optional data directory
     */
    constructor(dataDir?: string);
    /**
     * Open the store.
     */
    open(): Promise<void>;
    /**
     * Close the store.
     */
    close(): Promise<void>;
    /**
     * Get the public key.
     */
    getPublicKey(): string;
    /**
     * Check if writable.
     */
    get writable(): boolean;
    /**
     * Normalize a name for indexing (lowercase, trim).
     */
    private normalizeName;
    /**
     * Put ROM metadata with indexing.
     * @param metadata - ROM metadata to store
     */
    putRom(metadata: RomMetadata): Promise<void>;
    /**
     * Get ROM metadata by SHA1.
     * @param sha1 - SHA1 hash
     * @returns ROM metadata or null
     */
    getBySha1(sha1: string): Promise<RomMetadata | null>;
    /**
     * Get SHA1s by CRC32.
     * @param crc32 - CRC32 hash (case-insensitive)
     * @returns Array of SHA1 hashes
     */
    getByCrc32(crc32: string): Promise<string[]>;
    /**
     * Get SHA1s by name (normalized search).
     * @param name - ROM name (will be normalized)
     * @returns Array of SHA1 hashes
     */
    getByName(name: string): Promise<string[]>;
    /**
     * Get SHA1s by source.
     * @param source - DAT source
     * @returns Array of SHA1 hashes
     */
    getBySource(source: DatSource): Promise<string[]>;
    /**
     * Delete ROM metadata by SHA1.
     * @param sha1 - SHA1 hash
     */
    deleteBySha1(sha1: string): Promise<void>;
    /**
     * Get all entries (for iteration).
     */
    entries(): AsyncGenerator<[string, RomMetadata]>;
    /**
     * Get the underlying store.
     */
    getStore(): MetadataStore;
}
/**
 * Create an indexed metadata store.
 * @param dataDir - Optional data directory
 * @returns IndexedMetadataStore instance
 */
export declare function createIndexedStore(dataDir?: string): IndexedMetadataStore;
//# sourceMappingURL=indexed.d.ts.map