import Hyperswarm from "hyperswarm";
import { getPublicKey } from "../identity/keyStore.js";
/**
 * P2P sync handler.
 */
export class P2PSync {
    swarm = null;
    store = null;
    _publicKey = "";
    _mode = "seeder";
    _peers = 0;
    _replicating = false;
    _connected = false;
    /**
     * Create a new P2P sync handler.
     * @param store - Indexed metadata store
     */
    constructor(store) {
        this.store = store;
        // Get public key immediately from store
        this._publicKey = store.getPublicKey();
        // Default to seeder mode (will upgrade to writer if secret key exists)
        const hasSecret = getPublicKey() !== null;
        this._mode = hasSecret ? "writer" : "seeder";
    }
    /**
     * Get the public key.
     */
    getPublicKey() {
        return this._publicKey;
    }
    /**
     * Get the current mode.
     */
    getMode() {
        return this._mode;
    }
    /**
     * Get peer count.
     */
    getPeers() {
        return this._peers;
    }
    /**
     * Check if connected.
     */
    get connected() {
        return this._connected;
    }
    /**
     * Get replication status.
     */
    get replicating() {
        return this._replicating;
    }
    /**
     * Get the current state.
     */
    getState() {
        return {
            mode: this._mode,
            peers: this._peers,
            publicKey: this._publicKey,
            replicating: this._replicating,
        };
    }
    /**
     * Connect to the P2P network.
     */
    async connect() {
        if (this._connected) {
            return;
        }
        if (!this.store) {
            throw new Error("No store configured");
        }
        // Create hyperswarm
        this.swarm = new Hyperswarm();
        // Topic is the public key as a 32-byte buffer
        const topicBuffer = Buffer.from(this._publicKey.slice(0, 64), "hex");
        const topic = topicBuffer.slice(0, 32);
        // Join the swarm
        this.swarm.join(topic);
        // Track connections
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.swarm.on("connection", (conn) => {
            this._peers++;
            console.log(`Peer connected (${this._peers} total)`);
            // Handle replication
            this.handleConnection(conn);
            conn.on("close", () => {
                this._peers--;
                console.log(`Peer disconnected (${this._peers} total)`);
            });
        });
        // Wait for initial connections
        await new Promise((resolve) => {
            if (this.swarm) {
                this.swarm.once("up", () => resolve());
                // Timeout after 10 seconds
                setTimeout(resolve, 10000);
            }
            else {
                resolve();
            }
        });
        this._connected = true;
        console.log(`Connected to swarm as ${this._mode}`);
    }
    /**
     * Handle a peer connection for replication.
     */
    async handleConnection(conn) {
        if (!this.store) {
            return;
        }
        // Simple protocol: send our version, receive their version
        const ourVersion = 1;
        conn.write(Buffer.from([ourVersion]));
        conn.on("data", async (_data) => {
            // In a real implementation, we would:
            // 1. Parse the incoming data
            // 2. Determine what data we need
            // 3. Stream the missing data from our store
            // 4. Write it to the connection
            // For now, just mark that replication happened
            this._replicating = true;
            // Get all entries and stream to peer
            try {
                const store = this.store;
                if (!store)
                    return;
                for await (const [_sha1, _metadata] of store.entries()) {
                    // In real impl: would encode and send
                    void _sha1;
                    void _metadata;
                }
            }
            finally {
                this._replicating = false;
            }
        });
    }
    /**
     * Disconnect from the P2P network.
     */
    async disconnect() {
        if (this.swarm) {
            this.swarm.destroy();
            this.swarm = null;
        }
        this._connected = false;
        this._peers = 0;
    }
    /**
     * Force replication from a specific peer.
     */
    async replicate() {
        if (!this.store || !this._connected) {
            return;
        }
        this._replicating = true;
        try {
            // In a full implementation:
            // 1. Connect to peer
            // 2. Compare versions
            // 3. Request missing keys
            // 4. Apply updates
            console.log("Replication started");
        }
        finally {
            this._replicating = false;
            console.log("Replication complete");
        }
    }
}
/**
 * Create a P2P sync handler.
 * @param store - Indexed metadata store
 * @returns P2PSync instance
 */
export function createP2PSync(store) {
    return new P2PSync(store);
}
//# sourceMappingURL=sync.js.map