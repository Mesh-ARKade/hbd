import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startDeviceFlow, pollForToken, fetchGitHubUser, loadGitHubConfig } from "../src/identity/github.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GitHub Device Flow service", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.HBD_GITHUB_CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("startDeviceFlow()", () => {
    it("should throw when no client ID configured", async () => {
      delete process.env.HBD_GITHUB_CLIENT_ID;
      await expect(startDeviceFlow()).rejects.toThrow("not configured");
    });

    it("should return device flow response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: "device123",
          user_code: "USER-ABCD",
          verification_uri: "https://github.com/device",
          verification_uri_complete: "https://github.com/device/USER-ABCD",
          expires_in: 1800,
          interval: 5,
        }),
      });

      const result = await startDeviceFlow();
      expect(result.device_code).toBe("device123");
      expect(result.user_code).toBe("USER-ABCD");
    });
  });

  describe("pollForToken()", () => {
    it("should return token on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token123",
          token_type: "bearer",
        }),
      });

      const result = await pollForToken("device123");
      expect(result.access_token).toBe("token123");
    });

    it("should throw on authorization pending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "authorization_not_complete" }),
      });

      await expect(pollForToken("device123")).rejects.toThrow("authorization_not_complete");
    });
  });

  describe("fetchGitHubUser()", () => {
    it("should return user profile", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          login: "testuser",
          id: 123,
          name: "Test User",
        }),
      });

      const user = await fetchGitHubUser("token123");
      expect(user.login).toBe("testuser");
      expect(user.id).toBe(123);
    });
  });

  describe("loadGitHubConfig()", () => {
    it("should read client ID from env", () => {
      const config = loadGitHubConfig();
      expect(config.clientId).toBe("test-client-id");
    });
  });
});