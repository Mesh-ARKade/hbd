import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSyncPeer, connectToPeer, discoverPeers, P2PError, P2PNotOpenedError, P2PNoPeersError, P2PNoStoreError, SyncPeer } from "../src/p2p/sync.js";
import { MetadataStore, createMetadataStore } from "../src/storage/hyperbee.js";
import { isOk, isErr } from "../src/core/result.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";

describe("P2P Layer Result Refactor", () => {
  let testDir: string;
  let store: MetadataStore;

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-p2p-test");
    store = createMetadataStore(testDir);
    await store.open();
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("SyncPeer interface", () => {
    it("should have open, close, connect, disconnect methods", () => {
      const peer = createSyncPeer(testDir, store);
      expect(typeof peer.open).toBe("function");
      expect(typeof peer.close).toBe("function");
      expect(typeof peer.connect).toBe("function");
      expect(typeof peer.disconnect).toBe("function");
      expect(typeof peer.replicate).toBe("function");
      expect(typeof peer.getPeerCount).toBe("function");
      expect(typeof peer.setLogger).toBe("function");
    });
  });

  describe("createSyncPeer()", () => {
    it("should create a peer instance", () => {
      const peer = createSyncPeer(testDir, store);
      expect(peer).toBeInstanceOf(SyncPeer);
    });
  });

  describe("Error classes", () => {
    it("P2PNotOpenedError should exist", () => {
      expect(P2PNotOpenedError).toBeDefined();
      expect(new P2PNotOpenedError()).toBeInstanceOf(Error);
    });

    it("P2PNoPeersError should exist", () => {
      expect(P2PNoPeersError).toBeDefined();
    });

    it("P2PNoStoreError should exist", () => {
      expect(P2PNoStoreError).toBeDefined();
    });
  });

  describe("getPeerCount()", () => {
    it("should return 0 for empty peer", () => {
      const peer = createSyncPeer(testDir, store);
      expect(peer.getPeerCount()).toBe(0);
    });
  });

  describe("connectToPeer()", () => {
    it("should be a callable function", () => {
      expect(typeof connectToPeer).toBe("function");
    });
  });

  describe("discoverPeers()", () => {
    it("should be a callable function", () => {
      expect(typeof discoverPeers).toBe("function");
    });
  });

  describe("setLogger()", () => {
    it("should accept a logger", async () => {
      const { createLogger } = await import("../src/core/logger.js");
      const log = createLogger({ system: "p2p", level: "debug" });
      
      const peer = createSyncPeer(testDir, store);
      peer.setLogger(log);
      
      expect(true).toBe(true);
    });
  });
});