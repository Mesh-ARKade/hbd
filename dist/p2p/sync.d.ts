import type { IndexedMetadataStore } from "../storage/indexed.js";
/**
 * P2P networking layer for HBD.
 * @packageDocumentation
 * @intent Provide Hyperswarm-based peer discovery and database replication.
 * @guarantee Automatic sync from peers, seeder/writer mode toggle.
 */
/**
 * P2P mode of operation.
 */
export type P2PMode = "seeder" | "writer";
/**
 * P2P connection state.
 */
export interface P2PState {
    mode: P2PMode;
    peers: number;
    publicKey: string;
    replicating: boolean;
}
/**
 * P2P sync handler.
 */
export declare class P2PSync {
    private swarm;
    private store;
    private _publicKey;
    private _mode;
    private _peers;
    private _replicating;
    private _connected;
    /**
     * Create a new P2P sync handler.
     * @param store - Indexed metadata store
     */
    constructor(store: IndexedMetadataStore);
    /**
     * Get the public key.
     */
    getPublicKey(): string;
    /**
     * Get the current mode.
     */
    getMode(): P2PMode;
    /**
     * Get peer count.
     */
    getPeers(): number;
    /**
     * Check if connected.
     */
    get connected(): boolean;
    /**
     * Get replication status.
     */
    get replicating(): boolean;
    /**
     * Get the current state.
     */
    getState(): P2PState;
    /**
     * Connect to the P2P network.
     */
    connect(): Promise<void>;
    /**
     * Handle a peer connection for replication.
     */
    private handleConnection;
    /**
     * Disconnect from the P2P network.
     */
    disconnect(): Promise<void>;
    /**
     * Force replication from a specific peer.
     */
    replicate(): Promise<void>;
}
/**
 * Create a P2P sync handler.
 * @param store - Indexed metadata store
 * @returns P2PSync instance
 */
export declare function createP2PSync(store: IndexedMetadataStore): P2PSync;
//# sourceMappingURL=sync.d.ts.map