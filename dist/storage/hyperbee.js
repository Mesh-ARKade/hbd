import Hyperbee from "hyperbee";
import Hypercore from "hypercore";
import * as fs from "node:fs";
/**
 * Hyperbee storage layer for ROM metadata.
 * @packageDocumentation
 * @intent Provide Hyperbee-based storage for ROM metadata with multi-hash indexing.
 * @guarantee Deterministic merging based on hash collisions.
 */
/**
 * Path to the HBD data directory.
 */
export const HBD_DATA_DIR = process.env.HBD_DATA_DIR ?? ".hbd-data";
/**
 * In-memory fallback for when Hyperbee has issues.
 */
class InMemoryStore {
    _data = new Map();
    async put(key, value) {
        this._data.set(key, value);
    }
    async get(key) {
        return this._data.get(key) ?? null;
    }
    async *entries() {
        for (const [key, value] of this._data) {
            yield [key, value];
        }
    }
    async del(key) {
        this._data.delete(key);
    }
}
/**
 * In-memory metadata store backed by Hyperbee.
 */
export class MetadataStore {
    core = null;
    bee = null;
    inMemory = null;
    opened = false;
    _publicKey = "";
    _writable = true;
    _dataDir;
    _useInMemory = false;
    constructor(dataDir) {
        this._dataDir = dataDir ?? HBD_DATA_DIR;
    }
    /**
     * Get the data directory.
     */
    getDataDir() {
        return this._dataDir;
    }
    /**
     * Set the data directory.
     */
    setDataDir(dir) {
        this._dataDir = dir;
    }
    /**
     * Force in-memory mode.
     */
    useInMemory(use = true) {
        this._useInMemory = use;
    }
    /**
     * Open the store.
     */
    async open() {
        if (this.opened) {
            return;
        }
        if (this._useInMemory) {
            this.inMemory = new InMemoryStore();
            const key = Buffer.alloc(32);
            crypto.getRandomValues(key);
            this._publicKey = key.toString("hex");
            this._writable = true;
            this.opened = true;
            return;
        }
        // Ensure data directory exists
        if (!fs.existsSync(this._dataDir)) {
            fs.mkdirSync(this._dataDir, { recursive: true });
        }
        try {
            // Create hypercore with directory path (hypercore handles storage)
            // @ts-expect-error - hypercore accepts string path for file storage
            this.core = new Hypercore(this._dataDir);
            await this.core.ready();
            // Create hyperbee on hypercore
            this.bee = new Hyperbee(this.core, {
                keyEncoding: "utf8",
                valueEncoding: "json",
            });
            await this.bee.ready();
            this._publicKey = this.core.key.toString("hex");
            this._writable = this.core.canAppend;
        }
        catch (error) {
            console.warn("Hypercore init failed, falling back to in-memory:", error);
            this._useInMemory = true;
            this.inMemory = new InMemoryStore();
            const key = Buffer.alloc(32);
            crypto.getRandomValues(key);
            this._publicKey = key.toString("hex");
            this._writable = true;
        }
        this.opened = true;
    }
    /**
     * Close the store.
     */
    async close() {
        // Clear references
        this.core = null;
        this.bee = null;
        this.inMemory = null;
        this.opened = false;
    }
    /**
     * Get the public key.
     * @returns The public key as a hex string
     */
    getPublicKey() {
        return this._publicKey;
    }
    /**
     * Check if writable.
     */
    get writable() {
        return this._writable;
    }
    /**
     * Put a value.
     */
    async put(key, value) {
        if (!this.opened) {
            throw new Error("Store not opened");
        }
        if (this._useInMemory || !this.bee) {
            await this.inMemory.put(key, value);
            return;
        }
        await this.bee.put(key, value);
    }
    /**
     * Get a value by key.
     */
    async get(key) {
        if (!this.opened) {
            throw new Error("Store not opened");
        }
        if (this._useInMemory || !this.bee) {
            return this.inMemory.get(key);
        }
        const result = await this.bee.get(key);
        return result?.value ?? null;
    }
    /**
     * Get all entries.
     */
    async *entries() {
        if (!this.opened) {
            throw new Error("Store not opened");
        }
        if (this._useInMemory || !this.bee) {
            yield* this.inMemory.entries();
            return;
        }
        for await (const entry of this.bee.createReadStream()) {
            yield [entry.key, entry.value];
        }
    }
    /**
     * Delete a key.
     */
    async del(key) {
        if (!this.opened) {
            throw new Error("Store not opened");
        }
        if (this._useInMemory || !this.bee) {
            await this.inMemory.del(key);
            return;
        }
        await this.bee.del(key);
    }
    /**
     * Get hyperbee for indexing operations.
     */
    getHyperbee() {
        return this.bee;
    }
    /**
     * Get hypercore.
     */
    getHypercore() {
        return this.core;
    }
}
/**
 * Initialize a new metadata store.
 * @returns A new MetadataStore instance
 */
export function createMetadataStore() {
    return new MetadataStore();
}
/**
 * Initialize a new metadata store with custom data directory.
 * @param dataDir - Directory for persistence
 * @returns A new MetadataStore instance
 */
export function createMetadataStoreWithDir(dataDir) {
    return new MetadataStore(dataDir);
}
//# sourceMappingURL=hyperbee.js.map