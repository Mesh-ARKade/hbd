import Hyperbee from "hyperbee";
import Hypercore from "hypercore";
/**
 * Hyperbee storage layer for ROM metadata.
 * @packageDocumentation
 * @intent Provide Hyperbee-based storage for ROM metadata with multi-hash indexing.
 * @guarantee Deterministic merging based on hash collisions.
 */
/**
 * Path to the HBD data directory.
 */
export declare const HBD_DATA_DIR: string;
/**
 * Interface for keypair.
 */
export interface KeyPair {
    publicKey: Buffer;
    privateKey?: Buffer;
}
/**
 * In-memory metadata store backed by Hyperbee.
 */
export declare class MetadataStore {
    private core;
    private bee;
    private inMemory;
    private opened;
    private _publicKey;
    private _writable;
    private _dataDir;
    private _useInMemory;
    /**
     * Create a new metadata store.
     */
    constructor();
    /**
     * Create a new metadata store with custom data directory.
     * @param dataDir - Directory for persistence
     */
    constructor(dataDir?: string);
    /**
     * Get the data directory.
     */
    getDataDir(): string;
    /**
     * Set the data directory.
     */
    setDataDir(dir: string): void;
    /**
     * Force in-memory mode.
     */
    useInMemory(use?: boolean): void;
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
     * @returns The public key as a hex string
     */
    getPublicKey(): string;
    /**
     * Check if writable.
     */
    get writable(): boolean;
    /**
     * Put a value.
     */
    put(key: string, value: unknown): Promise<void>;
    /**
     * Get a value by key.
     */
    get(key: string): Promise<unknown | null>;
    /**
     * Get all entries.
     */
    entries(): AsyncGenerator<[string, unknown]>;
    /**
     * Delete a key.
     */
    del(key: string): Promise<void>;
    /**
     * Get hyperbee for indexing operations.
     */
    getHyperbee(): Hyperbee | null;
    /**
     * Get hypercore.
     */
    getHypercore(): Hypercore | null;
}
/**
 * Initialize a new metadata store.
 * @returns A new MetadataStore instance
 */
export declare function createMetadataStore(): MetadataStore;
/**
 * Initialize a new metadata store with custom data directory.
 * @param dataDir - Directory for persistence
 * @returns A new MetadataStore instance
 */
export declare function createMetadataStoreWithDir(dataDir: string): MetadataStore;
//# sourceMappingURL=hyperbee.d.ts.map