import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startDeviceFlow, pollForToken, fetchGitHubUser } from "../src/identity/github.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GitHub error handling", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.HBD_GITHUB_CLIENT_ID = "test-client-id";
  });

  describe("startDeviceFlow() error cases", () => {
    it("should throw when server returns error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Server Error",
      });

      await expect(startDeviceFlow()).rejects.toThrow("Device flow failed");
    });
  });

  describe("pollForToken() error cases", () => {
    it("should throw when client ID not configured", async () => {
      delete process.env.HBD_GITHUB_CLIENT_ID;
      await expect(pollForToken("device123")).rejects.toThrow("GitHub Client ID not configured");
    });

    it("should throw when server returns error (non-OK response)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Server Error",
        json: async () => ({ error: "server_error" }),
      });

      await expect(pollForToken("device123")).rejects.toThrow("Token request failed");
    });
  });

  describe("fetchGitHubUser() error cases", () => {
    it("should throw when API returns error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      });

      await expect(fetchGitHubUser("bad-token")).rejects.toThrow("Failed to fetch");
    });
  });
});