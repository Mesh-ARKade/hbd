import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  startDeviceFlow, 
  pollForToken, 
  fetchGitHubUser, 
  loadGitHubConfig
} from "../src/identity/github.js";
import { GitHubAuthError, GitHubConfigError, GitHubNetworkError } from "../src/identity/errors.js";
import { retry } from "../src/core/retry.js";
import { isOk, isErr } from "../src/core/result";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GitHub Auth Result Refactor", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.HBD_GITHUB_CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("loadGitHubConfig", () => {
    it('should return Result with config on success', () => {
      const result = loadGitHubConfig();
      expect(isOk(result)).toBe(true);
      expect(result.value.clientId).toBe("test-client-id");
    })

    it('should return error Result when no client ID', () => {
      delete process.env.HBD_GITHUB_CLIENT_ID;
      const result = loadGitHubConfig();
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(GitHubConfigError);
    })
  })

  describe("startDeviceFlow()", () => {
    it('should return Result with device flow response', async () => {
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
    });

    it('should return error Result when no client ID configured', async () => {
      delete process.env.HBD_GITHUB_CLIENT_ID;
      const result = await startDeviceFlow();
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(GitHubConfigError);
    });

    it('should return error Result on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await startDeviceFlow();
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(GitHubNetworkError);
    });
  });

  describe("pollForToken()", () => {
    it('should return Result with token on success', async () => {
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

    it('should return error Result on authorization pending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "authorization_not_complete" }),
      });

      const result = await pollForToken("device123");
      expect(isErr(result)).toBe(true);
    });

    it('should return error Result on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await pollForToken("device123");
      expect(isErr(result)).toBe(true);
      expect(result.error).toBeInstanceOf(GitHubNetworkError);
    });
  });

  describe("fetchGitHubUser()", () => {
    it('should return Result with user profile', async () => {
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
    });

    it('should return error Result on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await fetchGitHubUser("token123");
      expect(isErr(result)).toBe(true);
    });
  });

  // Full retry integration tested in retry.test.ts - GitHub Result refactor complete
});