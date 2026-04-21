/**
 * Tests for VaultService - GitHub Vault Integration
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VaultService, fetchWriterKey } from "../src/identity/vault.js";
import { UnauthorizedCuratorError } from "../src/identity/errors.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("VaultService", () => {
  let vault: VaultService;

  beforeEach(() => {
    vi.resetAllMocks();
    vault = new VaultService({
      repoOwner: "Mesh-ARKade",
      repoName: "hbd-writer-key",
    });
  });

  const defaultOptions = {
    repoOwner: "Mesh-ARKade",
    repoName: "hbd-writer-key",
  };

  describe("fetchWriterKey", () => {
    it("should fetch key successfully for authorized curator", async () => {
      const mockKeyData = {
        username: "curator123",
        publicKey: "a1b2c3d4e5f6...",
        secretKey: "secret789...",
        createdAt: "2025-04-21T00:00:00Z",
        expiresAt: "2025-04-28T00:00:00Z",
      };

      // GitHub returns base64 encoded content
      const base64Content = Buffer.from(JSON.stringify(mockKeyData)).toString("base64");

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: base64Content }),
      });

      const result = await fetchWriterKey("curator123", "valid-token", defaultOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.username).toBe("curator123");
        expect(result.value.secretKey).toBeDefined();
        expect(result.value.publicKey).toBeDefined();
      }
    });

    it("should return UnauthorizedCuratorError for 404 (not org member)", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Not Found" }),
      });

      const result = await fetchWriterKey("unauthorized", "token", defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(UnauthorizedCuratorError);
        expect(result.error.message).toContain("not authorized");
      }
    });

    it("should return error for expired token", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Bad credentials" }),
      });

      const result = await fetchWriterKey("curator123", "expired-token", defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("GitHub authentication");
      }
    });

    it("should return error for network failures", async () => {
      (fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchWriterKey("curator123", "token", defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("Network");
      }
    });

    it("should return error for invalid JSON response", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: "invalid-base64!!!" }),
      });

      const result = await fetchWriterKey("curator123", "token", defaultOptions);

      expect(result.ok).toBe(false);
    });
  });

  describe("VaultService.validateKey", () => {
    it("should validate a non-expired key", () => {
      const futureDate = new Date(Date.now() + 86400000 * 30); // 30 days from now
      const validKey = {
        username: "curator123",
        publicKey: "abc123",
        secretKey: "secret456",
        createdAt: new Date().toISOString(),
        expiresAt: futureDate.toISOString(),
      };

      const result = vault.validateKey(validKey);

      expect(result.ok).toBe(true);
    });

    it("should reject an expired key", () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      const expiredKey = {
        username: "curator123",
        publicKey: "abc123",
        secretKey: "secret456",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: pastDate.toISOString(),
      };

      const result = vault.validateKey(expiredKey);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("expired");
      }
    });

    it("should reject malformed key data", () => {
      const malformedKey = {
        username: "curator123",
        // Missing secretKey and publicKey
        createdAt: "2025-04-21T00:00:00Z",
        expiresAt: "2025-12-31T00:00:00Z",
      };

      const result = vault.validateKey(malformedKey as any);

      expect(result.ok).toBe(false);
    });
  });

  describe("VaultService.getKeyWithCache", () => {
    it("should return cached key if not expired", async () => {
      const mockKey = {
        username: "curator123",
        publicKey: "abc",
        secretKey: "secret",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
      };

      const base64Content = Buffer.from(JSON.stringify(mockKey)).toString("base64");

      // First call - fetches from API
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ content: base64Content }),
      });

      await vault.getKeyWithCache("curator123", "token");

      // Second call - should use cache, no additional fetch
      const result = await vault.getKeyWithCache("curator123", "token");

      expect(result.ok).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1); // Only called once
    });
  });
});
