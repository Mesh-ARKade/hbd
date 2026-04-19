import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startDeviceFlow, pollForToken, fetchGitHubUser, loadGitHubConfig } from "../src/identity/github.js";
import { isOk, isErr } from "../src/core/result.js";
import { GitHubAuthError, GitHubConfigError } from "../src/identity/errors.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GitHub Device Flow - Error Cases (Result-based)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.HBD_GITHUB_CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("startDeviceFlow() errors", () => {
    it("should return error when no client ID", async () => {
      delete process.env.HBD_GITHUB_CLIENT_ID;
      const result = await startDeviceFlow();
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(GitHubConfigError);
    });

    it("should return error on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error"
      });

      const result = await startDeviceFlow();
      expect(isErr(result)).toBe(true);
    });
  });

  describe("pollForToken() errors", () => {
    it("should return error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await pollForToken("device123");
      expect(isErr(result)).toBe(true);
    });

    it("should return error on authorization pending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "authorization_pending" })
      });

      const result = await pollForToken("device123");
      expect(isErr(result)).toBe(true);
    });
  });

  describe("fetchGitHubUser() errors", () => {
    it("should return error on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized"
      });

      const result = await fetchGitHubUser("bad-token");
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(GitHubAuthError);
    });
  });
});