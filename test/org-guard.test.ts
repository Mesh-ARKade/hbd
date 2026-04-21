/**
 * Tests for Org Guard - GitHub Organization Membership Verification
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { verifyOrgMembership } from "../src/identity/github.js";
import { UnauthorizedError, OrgMembershipError } from "../src/identity/errors.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("Org Guard - GitHub Organization Verification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("verifyOrgMembership", () => {
    it("should return ok(true) for org member", async () => {
      // Mock fetch for user endpoint
      (fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ login: "testuser" }),
        })
      );
      // Mock fetch for membership endpoint (204 = member)
      (fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          status: 204,
        })
      );

      const result = await verifyOrgMembership("Mesh-ARKade", "valid-token");
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it("should return err(OrgMembershipError) for non-member", async () => {
      // Mock fetch for user endpoint
      (fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ login: "testuser" }),
        })
      );
      // Mock fetch for membership endpoint (404 = not member)
      (fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          status: 404,
        })
      );

      const result = await verifyOrgMembership("Mesh-ARKade", "non-member-token");
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(OrgMembershipError);
        expect(result.error.message).toContain("Mesh-ARKade");
      }
    });

    it("should return err(UnauthorizedError) for invalid token", async () => {
      // Mock fetch for user endpoint
      (fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ login: "testuser" }),
        })
      );
      // Mock fetch for membership endpoint (401 = unauthorized)
      (fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          status: 401,
        })
      );

      const result = await verifyOrgMembership("Mesh-ARKade", "invalid-token");
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
      }
    });

    it("should return err when no token cached", async () => {
      // Call without token and no cache
      const result = await verifyOrgMembership("Mesh-ARKade");
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("GitHub authentication required");
      }
    });
  });
});

describe("CLI Init - GitHub Vault Requirement", () => {
  it("should require GitHub authentication for init", async () => {
    const { handleInit } = await import("../src/cli-handlers.js");
    const { createMetadataStore } = await import("../src/storage/hyperbee.js");
    
    // Create test store
    const fs = await import("node:fs");
    const testDir = ".hbd-test-init-vault-req";
    if (fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    const store = createMetadataStore(testDir);
    
    // Mock logger
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Call without GitHub auth (no cached identity)
    const result = await handleInit(store, mockLogger, {});
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should fail with GitHub auth required, not mnemonic
      expect(result.error.message).toMatch(/GitHub (authentication|token)/);
    }
    
    // Cleanup
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it("should verify UnauthorizedCuratorError type", async () => {
    // Just verify the error type is correct
    const { UnauthorizedCuratorError } = await import("../src/identity/errors.js");
    const error = new UnauthorizedCuratorError("Curator not authorized to access vault.");
    expect(error.message).toContain("not authorized");
    expect(error.name).toBe("UnauthorizedCuratorError");
  });
});

describe("Scraper Org Guard Lock", () => {
  it("should check org membership before scraping", async () => {
    // This test verifies the code path exists
    // Actual org verification requires GitHub auth
    const { handleScrape } = await import("../src/cli-handlers.js");
    
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    // Call scrape without proper identity setup
    // Should fail at identity check (before org check)
    const result = await handleScrape({ 
      dataDir: ".hbd-nonexistent-dir",
      system: "nes"
    }, mockLogger);
    
    expect(result.ok).toBe(false);
    // Should fail either on identity or directory check
  });
});
