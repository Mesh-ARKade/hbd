import { createMetadataStore } from "./hyperbee.js";
/**
 * ROM metadata indexing layer on top of Hyperbee.
 * @packageDocumentation
 * @intent Provide primary and secondary indexing for ROM metadata.
 * @guarantee Deterministic lookups by SHA1 (primary), CRC32, and Name (secondary).
 */
/**
 * Index prefixes for Hyperbee.
 */
const INDEX_PREFIXES = {
    /** Primary: SHA1 hash -> metadata */
    SHA1: "sha1:",
    /** Secondary: CRC32 -> SHA1 list */
    CRC32: "idx:crc32:",
    /** Secondary: normalized name -> SHA1 list */
    NAME: "idx:name:",
    /** Secondary: source -> SHA1 list */
    SOURCE: "idx:source:",
};
/**
 * Indexable ROM metadata store.
 */
export class IndexedMetadataStore {
    store;
    /**
     * Create a new indexed store.
     * @param dataDir - Optional data directory
     */
    constructor(dataDir) {
        if (dataDir) {
            const store = createMetadataStore();
            store.setDataDir(dataDir);
            this.store = store;
        }
        else {
            this.store = createMetadataStore();
        }
    }
    /**
     * Open the store.
     */
    async open() {
        await this.store.open();
    }
    /**
     * Close the store.
     */
    async close() {
        await this.store.close();
    }
    /**
     * Get the public key.
     */
    getPublicKey() {
        return this.store.getPublicKey();
    }
    /**
     * Check if writable.
     */
    get writable() {
        return this.store.writable;
    }
    /**
     * Normalize a name for indexing (lowercase, trim).
     */
    normalizeName(name) {
        return name.toLowerCase().trim();
    }
    /**
     * Put ROM metadata with indexing.
     * @param metadata - ROM metadata to store
     */
    async putRom(metadata) {
        const sha1 = metadata.sha1;
        // Primary index: SHA1 -> full metadata
        await this.store.put(INDEX_PREFIXES.SHA1 + sha1, metadata);
        // Secondary index: CRC32 -> SHA1
        const crc32Key = INDEX_PREFIXES.CRC32 + metadata.crc32.toLowerCase();
        const existingCrc = await this.store.get(crc32Key);
        if (existingCrc && Array.isArray(existingCrc)) {
            if (!existingCrc.includes(sha1)) {
                existingCrc.push(sha1);
                await this.store.put(crc32Key, existingCrc);
            }
        }
        else {
            await this.store.put(crc32Key, [sha1]);
        }
        // Secondary index: Name -> SHA1 (using normalized name)
        const nameKey = INDEX_PREFIXES.NAME + this.normalizeName(metadata.name);
        const existingName = await this.store.get(nameKey);
        if (existingName && Array.isArray(existingName)) {
            if (!existingName.includes(sha1)) {
                existingName.push(sha1);
                await this.store.put(nameKey, existingName);
            }
        }
        else {
            await this.store.put(nameKey, [sha1]);
        }
        // Secondary index: Source -> SHA1
        for (const source of metadata.sources) {
            const sourceKey = INDEX_PREFIXES.SOURCE + source;
            const existingSource = await this.store.get(sourceKey);
            if (existingSource && Array.isArray(existingSource)) {
                if (!existingSource.includes(sha1)) {
                    existingSource.push(sha1);
                    await this.store.put(sourceKey, existingSource);
                }
            }
            else {
                await this.store.put(sourceKey, [sha1]);
            }
        }
    }
    /**
     * Get ROM metadata by SHA1.
     * @param sha1 - SHA1 hash
     * @returns ROM metadata or null
     */
    async getBySha1(sha1) {
        const result = await this.store.get(INDEX_PREFIXES.SHA1 + sha1);
        return result;
    }
    /**
     * Get SHA1s by CRC32.
     * @param crc32 - CRC32 hash (case-insensitive)
     * @returns Array of SHA1 hashes
     */
    async getByCrc32(crc32) {
        const result = await this.store.get(INDEX_PREFIXES.CRC32 + crc32.toLowerCase());
        return result ?? [];
    }
    /**
     * Get SHA1s by name (normalized search).
     * @param name - ROM name (will be normalized)
     * @returns Array of SHA1 hashes
     */
    async getByName(name) {
        const result = await this.store.get(INDEX_PREFIXES.NAME + this.normalizeName(name));
        return result ?? [];
    }
    /**
     * Get SHA1s by source.
     * @param source - DAT source
     * @returns Array of SHA1 hashes
     */
    async getBySource(source) {
        const result = await this.store.get(INDEX_PREFIXES.SOURCE + source);
        return result ?? [];
    }
    /**
     * Delete ROM metadata by SHA1.
     * @param sha1 - SHA1 hash
     */
    async deleteBySha1(sha1) {
        // Get the metadata first to know what to remove from indices
        const metadata = await this.getBySha1(sha1);
        if (!metadata) {
            return;
        }
        // Remove from primary index
        await this.store.del(INDEX_PREFIXES.SHA1 + sha1);
        // Remove from CRC32 index
        const crc32Key = INDEX_PREFIXES.CRC32 + metadata.crc32.toLowerCase();
        const existingCrc = await this.store.get(crc32Key);
        if (existingCrc && Array.isArray(existingCrc)) {
            const filtered = existingCrc.filter((s) => s !== sha1);
            if (filtered.length > 0) {
                await this.store.put(crc32Key, filtered);
            }
            else {
                await this.store.del(crc32Key);
            }
        }
        // Remove from Name index
        const nameKey = INDEX_PREFIXES.NAME + this.normalizeName(metadata.name);
        const existingName = await this.store.get(nameKey);
        if (existingName && Array.isArray(existingName)) {
            const filtered = existingName.filter((s) => s !== sha1);
            if (filtered.length > 0) {
                await this.store.put(nameKey, filtered);
            }
            else {
                await this.store.del(nameKey);
            }
        }
        // Remove from Source indices
        for (const source of metadata.sources) {
            const sourceKey = INDEX_PREFIXES.SOURCE + source;
            const existingSource = await this.store.get(sourceKey);
            if (existingSource && Array.isArray(existingSource)) {
                const filtered = existingSource.filter((s) => s !== sha1);
                if (filtered.length > 0) {
                    await this.store.put(sourceKey, filtered);
                }
                else {
                    await this.store.del(sourceKey);
                }
            }
        }
    }
    /**
     * Get all entries (for iteration).
     */
    async *entries() {
        for await (const [key, value] of this.store.entries()) {
            if (key.startsWith(INDEX_PREFIXES.SHA1)) {
                yield [key.slice(INDEX_PREFIXES.SHA1.length), value];
            }
        }
    }
    /**
     * Get the underlying store.
     */
    getStore() {
        return this.store;
    }
}
/**
 * Create an indexed metadata store.
 * @param dataDir - Optional data directory
 * @returns IndexedMetadataStore instance
 */
export function createIndexedStore(dataDir) {
    return new IndexedMetadataStore(dataDir);
}
//# sourceMappingURL=indexed.js.map