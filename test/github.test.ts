import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startDeviceFlow, pollForToken, fetchGitHubUser, loadGitHubConfig } from "../src/identity/github.js";
import { isOk } from "../src/core/result.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GitHub Device Flow service (Result-based)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.HBD_GITHUB_CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("startDeviceFlow()", () => {
    it("should return error when no client ID configured", async () => {
      delete process.env.HBD_GITHUB_CLIENT_ID;
      const result = await startDeviceFlow();
      expect(result.ok).toBe(false);
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
      expect(isOk(result)).toBe(true);
      expect(result.value.device_code).toBe("device123");
      expect(result.value.user_code).toBe("USER-ABCD");
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
      expect(isOk(result)).toBe(true);
      expect(result.value.access_token).toBe("token123");
    });

    it("should return error on authorization pending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "authorization_not_complete" }),
      });

      const result = await pollForToken("device123");
      expect(result.ok).toBe(false);
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

      const result = await fetchGitHubUser("token123");
      expect(isOk(result)).toBe(true);
      expect(result.value.login).toBe("testuser");
      expect(result.value.id).toBe(123);
    });
  });

  describe("loadGitHubConfig()", () => {
    it("should read client ID from env", () => {
      const result = loadGitHubConfig();
      expect(isOk(result)).toBe(true);
      expect(result.value.clientId).toBe("test-client-id");
    });
  });
});