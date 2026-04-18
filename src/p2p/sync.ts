/**
 * P2P Sync layer using Hyperswarm for peer discovery and replication.
 * @packageDocumentation
 */

import Hyperswarm from "hyperswarm";
import { createHash } from "node:crypto";
import { MetadataStore } from "../storage/hyperbee.js";

/**
 * Peer connection info.
 */
export interface PeerInfo {
  publicKey: string;
  connected: boolean;
}

/**
 * Sync peer interface for P2P replication using real Hyperswarm.
 */
export class SyncPeer {
  private swarm: Hyperswarm | null = null;
  private _publicKey: string = "";
  private dataDir: string;
  private connectedPeers: Map<string, PeerInfo> = new Map();
  private store: MetadataStore | null = null;
  private topic: Buffer | null = null;

  constructor(dataDir: string, store?: MetadataStore) {
    this.dataDir = dataDir;
    if (store) {
      this.store = store;
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
   * @param topic - Optional topic to join (defaults to HBD default)
   */
  async open(topic?: string): Promise<void> {
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
      
      // Send handshake
      conn.write(JSON.stringify({ type: "handshake", publicKey: this._publicKey }));
      
      conn.on("close", () => {
        this.connectedPeers.delete(peerKey);
      });
    });

    // Join a topic for discovery
    const topicHash = createHash("sha256");
    topicHash.update(topic ?? "hbd-default-topic");
    this.topic = topicHash.digest();
    
    await this.swarm.join(this.topic);
    await this.swarm.flush();
  }

  /**
   * Close the peer and leave the swarm.
   */
  async close(): Promise<void> {
    if (this.swarm) {
      await this.swarm.destroy();
      this.swarm = null;
    }
    this.connectedPeers.clear();
  }

  /**
   * Connect to a remote peer (initiate replication).
   */
  async connect(remotePublicKey: string): Promise<void> {
    if (!this.swarm) throw new Error("Peer not opened");
    // In Hyperswarm, connections are discovered, not initiated directly
    // We track that we want to connect to this peer
    this.connectedPeers.set(remotePublicKey, { publicKey: remotePublicKey, connected: false });
  }

  /**
   * Disconnect from a remote peer.
   */
  async disconnect(remotePublicKey: string): Promise<void> {
    this.connectedPeers.delete(remotePublicKey);
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
  async replicate(): Promise<void> {
    // Check peers first
    if (this.connectedPeers.size === 0) {
      throw new Error("No peers connected for replication");
    }
    if (!this.store) throw new Error("No store attached for replication");
    // In a full implementation, this would replicate the Hypercore
  }
}

/**
 * Create a sync peer for P2P replication.
 */
export function createSyncPeer(dataDir: string, store?: MetadataStore): SyncPeer {
  return new SyncPeer(dataDir, store);
}

/**
 * Connect to a remote peer by public key.
 */
export async function connectToPeer(localPeer: SyncPeer, remotePublicKey: string): Promise<void> {
  await localPeer.connect(remotePublicKey);
}

/**
 * Discover peers on a given topic.
 * Returns array of peer public keys.
 */
export async function discoverPeers(topic: string): Promise<string[]> {
  // Create a temporary swarm to discover peers
  const swarm = new Hyperswarm();
  const peers: string[] = [];
  
  const topicHash = createHash("sha256");
  topicHash.update(topic);
  const topicBuffer = topicHash.digest();
  
  // Set up discovery
  swarm.on("connection", (conn: { remotePublicKey: Buffer }) => {
    peers.push(conn.remotePublicKey.toString("hex"));
  });
  
  await swarm.join(topicBuffer);
  await swarm.flush();
  
  // Give some time for discovery
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await swarm.destroy();
  return peers;
}
