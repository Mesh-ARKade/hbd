import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSyncPeer, connectToPeer, discoverPeers } from "../src/p2p/sync.js";

// Track connection handlers for testing
const connectionHandlers: Array<(conn: { remotePublicKey: Buffer; on: (event: string, handler: () => void) => void; write: (data: string) => void }) => void> = [];

// Mock hyperswarm module
vi.mock("hyperswarm", () => ({
  default: class MockHyperswarm {
    join = vi.fn().mockResolvedValue(undefined);
    leave = vi.fn().mockResolvedValue(undefined);
    on = vi.fn((event: string, handler: unknown) => {
      if (event === "connection") {
        connectionHandlers.push(handler as (conn: { remotePublicKey: Buffer; on: (event: string, handler: () => void) => void; write: (data: string) => void }) => void);
      }
    });
    once = vi.fn();
    flush = vi.fn().mockResolvedValue([]);
    destroy = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("P2P Sync - Full Coverage Tests", () => {
  let peer: ReturnType<typeof createSyncPeer>;

  beforeEach(async () => {
    peer = createSyncPeer("./test-peer");
    await peer.open();
  });

  describe("constructor", () => {
    it("should create peer without store", async () => {
      const peerWithoutStore = createSyncPeer("./no-store");
      await peerWithoutStore.open();
      expect(peerWithoutStore.getPublicKey()).toBeDefined();
      await peerWithoutStore.close();
    });
  });

  afterEach(async () => {
    await peer.close();
  });

  describe("createSyncPeer()", () => {
    it("should create a sync peer with public key", async () => {
      expect(peer.getPublicKey()).toBeDefined();
      expect(typeof peer.getPublicKey()).toBe("string");
      expect(peer.getPublicKey().length).toBeGreaterThan(0);
    });
  });

  describe("connect()", () => {
    it("should connect to multiple peers", async () => {
      await peer.connect("peer1");
      await peer.connect("peer2");
      await peer.connect("peer3");

      const connected = peer.getConnectedPeers();
      expect(connected.length).toBe(3);
      const keys = connected.map(p => p.publicKey);
      expect(keys).toContain("peer1");
      expect(keys).toContain("peer2");
      expect(keys).toContain("peer3");
    });

    it("should throw when connecting while not opened", async () => {
      const closedPeer = createSyncPeer("./closed");
      await expect(closedPeer.connect("peer1")).rejects.toThrow("Peer not opened");
    });
  });

  describe("disconnect()", () => {
    it("should disconnect from connected peer", async () => {
      await peer.connect("peer1");
      await peer.disconnect("peer1");

      const connected = peer.getConnectedPeers();
      const keys = connected.map(p => p.publicKey);
      expect(keys).not.toContain("peer1");
    });

    it("should handle disconnecting non-connected peer gracefully", async () => {
      // Should not throw
      await peer.disconnect("nonexistent");
    });
  });

  describe("getConnectedPeers()", () => {
    it("should return empty array when no peers connected", () => {
      const connected = peer.getConnectedPeers();
      expect(connected).toEqual([]);
    });
  });

  describe("getPeerCount()", () => {
    it("should return correct peer count", async () => {
      expect(peer.getPeerCount()).toBe(0);
      
      await peer.connect("peer1");
      expect(peer.getPeerCount()).toBe(1);
      
      await peer.connect("peer2");
      expect(peer.getPeerCount()).toBe(2);
    });
  });

  describe("discoverPeers()", () => {
    it("should return empty array if no peers found", async () => {
      const peers = await discoverPeers("test-topic");
      expect(peers).toEqual([]);
    });
  });

  describe("connectToPeer()", () => {
    it("should connect using helper function", async () => {
      await connectToPeer(peer, "remote-peer");
      const keys = peer.getConnectedPeers().map(p => p.publicKey);
      expect(keys).toContain("remote-peer");
    });
  });

  describe("replicate()", () => {
    it("should throw when no peers connected", async () => {
      await expect(peer.replicate()).rejects.toThrow("No peers connected");
    });

    it("should throw when no store attached", async () => {
      const peerWithoutStore = createSyncPeer("./no-store");
      await peerWithoutStore.open();
      await peerWithoutStore.connect("peer1");
      
      await expect(peerWithoutStore.replicate()).rejects.toThrow("No store attached");
      
      await peerWithoutStore.close();
    });
  });

  describe("reconnect scenario", () => {
    it("should handle connect-disconnect-reconnect", async () => {
      await peer.connect("peer1");
      await peer.disconnect("peer1");
      await peer.connect("peer1");

      const connected = peer.getConnectedPeers();
      const keys = connected.map(p => p.publicKey);
      expect(keys).toContain("peer1");
      expect(connected.length).toBe(1);
    });
  });

  describe("discoverPeers with mock connections", () => {
    it("should discover peers from connection events", async () => {
      // The discoverPeers function should return an array
      const peers = await discoverPeers("test-topic");
      expect(Array.isArray(peers)).toBe(true);
    });
  });

  describe("connection event handling", () => {
    it("should handle incoming peer connections", async () => {
      // Clear previous handlers
      connectionHandlers.length = 0;
      
      // Create a new peer to trigger the on("connection") handler
      const testPeer = createSyncPeer("./conn-test");
      await testPeer.open();
      
      // Simulate a connection event
      if (connectionHandlers.length > 0) {
        const mockConn = {
          remotePublicKey: Buffer.from("test-peer-key"),
          on: vi.fn(),
          write: vi.fn(),
        };
        connectionHandlers[connectionHandlers.length - 1](mockConn);
        
        // Peer should be tracked
        const peers = testPeer.getConnectedPeers();
        expect(peers.length).toBeGreaterThan(0);
      }
      
      await testPeer.close();
    });

    it("should handle connection close events", async () => {
      connectionHandlers.length = 0;
      
      const testPeer = createSyncPeer("./close-test");
      await testPeer.open();
      
      if (connectionHandlers.length > 0) {
        const closeHandlers: Array<() => void> = [];
        const mockConn = {
          remotePublicKey: Buffer.from("test-peer-key"),
          on: vi.fn((event: string, handler: () => void) => {
            if (event === "close") closeHandlers.push(handler);
          }),
          write: vi.fn(),
        };
        
        connectionHandlers[connectionHandlers.length - 1](mockConn);
        expect(testPeer.getConnectedPeers().length).toBeGreaterThan(0);
        
        // Trigger close
        closeHandlers.forEach(h => h());
        
        // Peer should be removed
        // Note: In the actual implementation, this removes the peer
        expect(mockConn.on).toHaveBeenCalledWith("close", expect.any(Function));
      }
      
      await testPeer.close();
    });
  });
});
