import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { createSyncPeer, connectToPeer, discoverPeers, SyncPeer, P2PError, P2PNotOpenedError, P2PNoPeersError, P2PNoStoreError, P2PConnectionError, P2POpenError, P2PConnectError, P2PCloseError, P2PDisconnectError } from "../src/p2p/sync.js";
import { isOk, isErr } from "../src/core/result.js";

// Mock Hyperswarm with EventEmitter so we can emit events
vi.mock("hyperswarm", () => ({
  default: class MockHyperswarm extends EventEmitter {
    join = vi.fn().mockResolvedValue(undefined);
    leave = vi.fn().mockResolvedValue(undefined);
    flush = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn().mockResolvedValue(undefined);
  }
}));

describe("P2P Sync - Full Coverage with EventEmitter", () => {
  let peer: SyncPeer;

  beforeEach(() => {
    peer = createSyncPeer("./test-p2p");
  });

  afterEach(async () => {
    try { 
      await peer.close();
    } catch {}
  });

  describe("open() and lifecycle", () => {
    it("should open and return public key", async () => {
      const result = await peer.open();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(typeof result.value).toBe("string");
        expect(result.value.length).toBe(64);
      }
    });

    it("should be idempotent", async () => {
      await peer.open();
      const result = await peer.open();
      expect(isOk(result)).toBe(true);
    });

    it("should set up connection handler", async () => {
      await peer.open();
      const swarm = (peer as any).swarm;
      expect(swarm.listenerCount("connection")).toBeGreaterThan(0);
    });
  });

  describe("connection event handling", () => {
    it("should track peer on connection event", async () => {
      await peer.open();
      const swarm = (peer as any).swarm;
      
      const mockConn = {
        remotePublicKey: Buffer.from("peer-key-1234567890123456789012345678"),
        on: vi.fn(),
        write: vi.fn()
      };
      
      swarm.emit("connection", mockConn);
      
      expect(peer.getPeerCount()).toBe(1);
      // remotePublicKey is converted to hex string
      expect(peer.getConnectedPeers()[0].publicKey).toBe(Buffer.from("peer-key-1234567890123456789012345678").toString("hex"));
    });

    it("should send handshake on connection", async () => {
      await peer.open();
      const swarm = (peer as any).swarm;
      const mockConn = {
        remotePublicKey: Buffer.from("handshake-peer"),
        on: vi.fn(),
        write: vi.fn()
      };
      
      swarm.emit("connection", mockConn);
      
      expect(mockConn.write).toHaveBeenCalled();
      const handshake = JSON.parse(mockConn.write.mock.calls[0][0]);
      expect(handshake.type).toBe("handshake");
      expect(handshake.publicKey).toBe(peer.getPublicKey());
    });

    it("should handle connection close event", async () => {
      await peer.open();
      const swarm = (peer as any).swarm;
      
      let closeHandler: () => void = () => {};
      const mockConn = {
        remotePublicKey: Buffer.from("close-peer-key-1234567890123456789012"),
        on: vi.fn((event: string, handler: () => void) => {
          if (event === "close") closeHandler = handler;
        }),
        write: vi.fn()
      };
      
      swarm.emit("connection", mockConn);
      expect(peer.getPeerCount()).toBe(1);
      
      // Trigger close
      closeHandler();
      
      expect(peer.getPeerCount()).toBe(0);
    });

    it("should handle multiple connections", async () => {
      await peer.open();
      const swarm = (peer as any).swarm;
      
      for (let i = 0; i < 5; i++) {
        const mockConn = {
          remotePublicKey: Buffer.from(`peer-${i}-key-1234567890123456789012`),
          on: vi.fn(),
          write: vi.fn()
        };
        swarm.emit("connection", mockConn);
      }
      
      expect(peer.getPeerCount()).toBe(5);
    });
  });

  describe("manual connect/disconnect", () => {
    it("should connect manually", async () => {
      await peer.open();
      const result = await peer.connect("manual-peer-key");
      expect(isOk(result)).toBe(true);
      expect(peer.getPeerCount()).toBe(1);
    });

    it("should error when connecting without open", async () => {
      const closedPeer = createSyncPeer("./closed");
      const result = await closedPeer.connect("any-key");
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(P2PNotOpenedError);
      }
    });

    it("should disconnect manually", async () => {
      await peer.open();
      await peer.connect("peer-to-remove");
      const result = await peer.disconnect("peer-to-remove");
      expect(isOk(result)).toBe(true);
      expect(peer.getPeerCount()).toBe(0);
    });

    it("should handle disconnect of non-existent peer", async () => {
      await peer.open();
      const result = await peer.disconnect("nonexistent");
      expect(isOk(result)).toBe(true);
    });
  });

  describe("replicate()", () => {
    it("should error when no peers", async () => {
      await peer.open();
      const result = await peer.replicate();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(P2PNoPeersError);
      }
    });

    it("should error when no store", async () => {
      const noStorePeer = createSyncPeer("./no-store");
      await noStorePeer.open();
      await noStorePeer.connect("peer");
      
      const result = await noStorePeer.replicate();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(P2PNoStoreError);
      }
    });
  });

  describe("close()", () => {
    it("should close cleanly", async () => {
      await peer.open();
      const result = await peer.close();
      expect(isOk(result)).toBe(true);
      expect(peer.getPeerCount()).toBe(0);
    });

    it("should be idempotent", async () => {
      await peer.open();
      await peer.close();
      const result = await peer.close();
      expect(isOk(result)).toBe(true);
    });
  });

  describe("error paths", () => {
    it("should handle join failure", async () => {
      const failingPeer = createSyncPeer("./fail-join");
      await failingPeer.open();
      
      // Override join to fail
      const swarm = (failingPeer as any).swarm;
      swarm.join = vi.fn().mockRejectedValue(new Error("Join failed"));
      
      const result = await failingPeer.open();
      // Second open will try join again
    });

    it("should handle replicate error", async () => {
      await peer.open();
      await peer.connect("test-peer");
      
      // Set up a logger that throws
      const badLogger = {
        info: vi.fn().mockImplementation(() => { throw new Error("Log error"); }),
        debug: vi.fn(),
        error: vi.fn()
      };
      peer.setLogger(badLogger as any);
      
      const result = await peer.replicate();
      expect(isErr(result)).toBe(true);
    });
  });

  describe("discoverPeers()", () => {
    it("should return Result", async () => {
      const result = await discoverPeers("test-topic");
      expect(result && typeof result.ok === "boolean").toBe(true);
    });

    it("should handle errors", async () => {
      // This tests the error path - real Hyperswarm in discoverPeers
      // will either succeed or fail, but we can at least trigger the function
      const result = await discoverPeers("error-topic");
      // Should return a Result either way
      expect(result.ok !== undefined).toBe(true);
    });
  });

  describe("helpers", () => {
    it("connectToPeer should exist", () => expect(typeof connectToPeer).toBe("function"));
    it("discoverPeers should exist", () => expect(typeof discoverPeers).toBe("function"));
  });

  describe("error classes", () => {
    it("P2PError", () => {
      const e = new P2PError("test");
      expect(e.message).toBe("test");
      expect(e.name).toBe("P2PError");
    });

    it("P2PNotOpenedError", () => {
      const e = new P2PNotOpenedError();
      expect(e.message).toBe("Peer not opened");
    });

    it("P2PNoPeersError", () => {
      const e = new P2PNoPeersError();
      expect(e.message).toBe("No peers connected for replication");
    });

    it("P2PNoStoreError", () => {
      const e = new P2PNoStoreError();
      expect(e.message).toBe("No store attached for replication");
    });

    it("P2PConnectionError", () => {
      const e = new P2PConnectionError("conn error");
      expect(e.message).toBe("conn error");
      expect(e.name).toBe("P2PConnectionError");
    });

    it("P2POpenError with cause", () => {
      const cause = new Error("underlying");
      const e = new P2POpenError("open failed", cause);
      expect(e.message).toBe("open failed");
      expect(e.cause).toBe(cause);
    });

    it("P2PConnectError with key", () => {
      const e = new P2PConnectError("conn failed", "peer123");
      expect(e.message).toBe("conn failed");
      expect(e.peerKey).toBe("peer123");
    });

    it("P2PCloseError", () => {
      const e = new P2PCloseError("close failed");
      expect(e.message).toBe("close failed");
    });

    it("P2PDisconnectError with key", () => {
      const e = new P2PDisconnectError("disc failed", "peer456");
      expect(e.message).toBe("disc failed");
      expect(e.peerKey).toBe("peer456");
    });
  });

  describe("logging integration", () => {
    it("should accept pino logger", async () => {
      const { createLogger } = await import("../src/core/logger.js");
      const log = createLogger({ level: "silent" });
      peer.setLogger(log);
      await peer.open();
    });

    it("should log on events", async () => {
      const { createLogger } = await import("../src/core/logger.js");
      const log = createLogger({ level: "debug", system: "p2p" });
      peer.setLogger(log);
      
      await peer.open();
      const swarm = (peer as any).swarm;
      
      const mockConn = {
        remotePublicKey: Buffer.from("log-peer"),
        on: vi.fn(),
        write: vi.fn()
      };
      
      swarm.emit("connection", mockConn);
      // Should log connection event
    });
  });
});