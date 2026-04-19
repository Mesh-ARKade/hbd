import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { discoverPeers, createSyncPeer, P2POpenError, P2PCloseError, P2PConnectError, P2PDisconnectError } from "../src/p2p/sync.js";
import { isOk, isErr } from "../src/core/result.js";

// Mock Hyperswarm for discoverPeers
class MockHyperswarm extends EventEmitter {
  joined = false;
  flushed = false;
  destroyed = false;
  
  join() { 
    this.joined = true; 
    return Promise.resolve(); 
  }
  
  flush() { 
    this.flushed = true; 
    return Promise.resolve(); 
  }
  
  destroy() { 
    this.destroyed = true; 
    return Promise.resolve(); 
  }
}

describe("P2P discoverPeers with DI", () => {
  it("should discover peers via injected swarm", async () => {
    const mockSwarm = new MockHyperswarm();
    
    // Emit connections after a small delay
    setTimeout(() => {
      mockSwarm.emit("connection", { 
        remotePublicKey: Buffer.from("peer1-key") 
      });
      mockSwarm.emit("connection", { 
        remotePublicKey: Buffer.from("peer2-key") 
      });
    }, 10);
    
    const result = await discoverPeers("test-topic", mockSwarm);
    
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.length).toBe(2);
      expect(result.value[0]).toBe(Buffer.from("peer1-key").toString("hex"));
    }
  });

  it("should return empty array when no peers", async () => {
    const mockSwarm = new MockHyperswarm();
    
    const result = await discoverPeers("empty-topic", mockSwarm);
    
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([]);
    }
  });

  it("should handle swarm errors", async () => {
    const mockSwarm = new MockHyperswarm();
    mockSwarm.join = vi.fn().mockRejectedValue(new Error("Network error"));
    
    const result = await discoverPeers("error-topic", mockSwarm);
    
    expect(isErr(result)).toBe(true);
  });
});

describe("P2P Error Classes", () => {
  it("P2POpenError with cause", () => {
    const cause = new Error("underlying");
    const e = new P2POpenError("open failed", cause);
    expect(e.message).toBe("open failed");
    expect(e.cause).toBe(cause);
    expect(e.name).toBe("P2POpenError");
  });

  it("P2PCloseError", () => {
    const e = new P2PCloseError("close failed");
    expect(e.message).toBe("close failed");
    expect(e.name).toBe("P2PCloseError");
  });

  it("P2PConnectError with peerKey", () => {
    const e = new P2PConnectError("connect failed", "peer123");
    expect(e.message).toBe("connect failed");
    expect(e.peerKey).toBe("peer123");
    expect(e.name).toBe("P2PConnectError");
  });

  it("P2PDisconnectError with peerKey", () => {
    const e = new P2PDisconnectError("disconnect failed", "peer456");
    expect(e.message).toBe("disconnect failed");
    expect(e.peerKey).toBe("peer456");
    expect(e.name).toBe("P2PDisconnectError");
  });
});

describe("P2P SyncPeer basic", () => {
  it("createSyncPeer should exist", () => {
    expect(typeof createSyncPeer).toBe("function");
  });
});