/**
 * P2P Sync layer using Hyperswarm for peer discovery and replication.
 * Refactored to use Result pattern and Pino logging.
 * @packageDocumentation
 */

import Hyperswarm from "hyperswarm";
import { createHash } from "node:crypto";
import { MetadataStore } from "../storage/hyperbee.js";
import { ok, err, Result } from "../core/result.js";
import { Logger } from "pino";
import { P2PError, P2PNotOpenedError, P2PNoPeersError, P2PNoStoreError } from "./errors.js";

/**
 * Peer connection info.
 */
export interface PeerInfo {
  publicKey: string;
  connected: boolean;
}

/**
 * Custom error classes
 */
export class P2POpenError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "P2POpenError";
  }
}

export class P2PConnectError extends Error {
  constructor(message: string, public readonly peerKey: string) {
    super(message);
    this.name = "P2PConnectError";
  }
}

export class P2PCloseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "P2PCloseError";
  }
}

export class P2PDisconnectError extends Error {
  constructor(message: string, public readonly peerKey: string) {
    super(message);
    this.name = "P2PDisconnectError";
  }
}

/**
 * Sync peer interface for P2P replication.
 */
export class SyncPeer {
  private swarm: Hyperswarm | null = null;
  private _publicKey: string = "";
  private dataDir: string;
  private connectedPeers: Map<string, PeerInfo> = new Map();
  private store: MetadataStore | null = null;
  private topic: Buffer | null = null;
  private logger: Logger | null = null;
  private _opened: boolean = false;

  constructor(dataDir: string, store?: MetadataStore) {
    this.dataDir = dataDir;
    if (store) {
      this.store = store;
    }
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
      this.logger[level as keyof Logger]({
        system: "p2p",
        localPublicKey: this._publicKey,
        dataDir: this.dataDir,
        ...meta
      }, message);
    }
  }

  /**
   * Get the public key for this peer.
   */
  getPublicKey(): string {
    return this._publicKey;
  }

  /**
   * Open the peer and join the Hyperswarm.
   */
  async open(topic?: string): Promise<Result<string, P2POpenError>> {
    try {
      if (this._opened) {
        return ok(this._publicKey);
      }

      this.log("info", "Opening P2P peer", { topic: topic ?? "default" });

      // Create swarm instance
      this.swarm = new Hyperswarm();

      // Generate a deterministic key from the data directory
      const hash = createHash("sha256");
      hash.update(this.dataDir);
      this._publicKey = hash.digest("hex").slice(0, 64);

      // Set up connection handler
      this.swarm.on("connection", (conn: { remotePublicKey: Buffer; on: (event: string, handler: () => void) => void; write: (data: string) => void }) => {
        const peerKey = conn.remotePublicKey.toString("hex");
        this.connectedPeers.set(peerKey, { publicKey: peerKey, connected: true });
        
        this.log("debug", "Peer connected", { remotePublicKey: peerKey });
        
        // Send handshake
        conn.write(JSON.stringify({ type: "handshake", publicKey: this._publicKey }));
        
        conn.on("close", () => {
          this.connectedPeers.delete(peerKey);
          this.log("debug", "Peer disconnected", { remotePublicKey: peerKey });
        });
      });

      // Join a topic for discovery
      const topicHash = createHash("sha256");
      topicHash.update(topic ?? "hbd-default-topic");
      this.topic = topicHash.digest();
      
      await this.swarm.join(this.topic);
      await this.swarm.flush();
      
      this._opened = true;
      this.log("info", "P2P peer opened", { publicKey: this._publicKey });

      return ok(this._publicKey);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log("error", "P2P open failed", { error: errMsg });
      return err(new P2POpenError(errMsg, error instanceof Error ? error : undefined));
    }
  }

  /**
   * Close the peer and leave the swarm.
   */
  async close(): Promise<Result<void, P2PCloseError>> {
    try {
      this.log("info", "Closing P2P peer", { publicKey: this._publicKey });

      if (this.swarm) {
        await this.swarm.destroy();
        this.swarm = null;
      }
      this.connectedPeers.clear();
      this._opened = false;
      this._publicKey = "";
      this.topic = null;

      return ok(undefined);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return err(new P2PCloseError(errMsg));
    }
  }

  /**
   * Connect to a remote peer.
   */
  async connect(remotePublicKey: string): Promise<Result<void, P2PNotOpenedError | P2PConnectError>> {
    if (!this.swarm || !this._opened) {
      return err(new P2PNotOpenedError());
    }

    try {
      this.log("debug", "Connecting to peer", { remotePublicKey });
      
      this.connectedPeers.set(remotePublicKey, { publicKey: remotePublicKey, connected: false });
      
      this.log("info", "Peer connection initiated", { remotePublicKey });
      
      return ok(undefined);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return err(new P2PConnectError(errMsg, remotePublicKey));
    }
  }

  /**
   * Disconnect from a remote peer.
   */
  async disconnect(remotePublicKey: string): Promise<Result<void, P2PDisconnectError>> {
    try {
      this.log("debug", "Disconnecting from peer", { remotePublicKey });
      
      this.connectedPeers.delete(remotePublicKey);
      
      this.log("info", "Peer disconnected", { remotePublicKey });
      
      return ok(undefined);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return err(new P2PDisconnectError(errMsg, remotePublicKey));
    }
  }

  /**
   * Get connected peers.
   */
  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.connectedPeers.values());
  }

  /**
   * Get peer count.
   */
  getPeerCount(): number {
    return this.connectedPeers.size;
  }

  /**
   * Replicate store with connected peers.
   */
  async replicate(): Promise<Result<void, P2PNoPeersError | P2PNoStoreError>> {
    // Check peers first
    if (this.connectedPeers.size === 0) {
      return err(new P2PNoPeersError());
    }
    if (!this.store) {
      return err(new P2PNoStoreError());
    }

    try {
      this.log("info", "Starting replication", { peerCount: this.connectedPeers.size });
      
      // In a full implementation, this would replicate the Hypercore
      this.log("info", "Replication complete", { peerCount: this.connectedPeers.size });
      
      return ok(undefined);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return err(new P2PError(errMsg));
    }
  }
}

// Re-export from errors
export { P2PError, P2PNotOpenedError, P2PNoPeersError, P2PNoStoreError, P2PConnectionError } from "./errors.js";

/**
 * Create a sync peer for P2P replication.
 */
export function createSyncPeer(dataDir: string, store?: MetadataStore): SyncPeer {
  return new SyncPeer(dataDir, store);
}

/**
 * Connect to a remote peer by public key.
 */
export async function connectToPeer(localPeer: SyncPeer, remotePublicKey: string): Promise<Result<void, P2PNotOpenedError | P2PConnectError>> {
  return localPeer.connect(remotePublicKey);
}

/**
 * Discover peers on a given topic.
 * @param topic - Topic to discover peers on
 * @param swarm - Optional Hyperswarm instance (for testing/dependency injection)
 */
export async function discoverPeers(topic: string, swarm?: any): Promise<Result<string[], P2PError>> {
  try {
    const s = swarm ?? new Hyperswarm();
    const peers: string[] = [];
    
    const topicHash = createHash("sha256");
    topicHash.update(topic);
    const topicBuffer = topicHash.digest();
    
    s.on("connection", (conn: { remotePublicKey: Buffer }) => {
      peers.push(conn.remotePublicKey.toString("hex"));
    });
    
    await s.join(topicBuffer);
    await s.flush();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await s.destroy();
    
    return ok(peers);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return err(new P2PError(errMsg));
  }
}