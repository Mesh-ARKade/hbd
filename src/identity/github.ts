/**
 * GitHub Device Flow authentication service.
 * Refactored to use Result pattern for explicit error handling.
 * @packageDocumentation
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "./keyStore.js";
import { ok, err, Result } from "../core/result.js";
import {
  GitHubConfigError,
  GitHubAuthError,
  GitHubNetworkError,
  UnauthorizedError,
  OrgMembershipError,
} from "./errors.js";

export interface GitHubConfig {
  clientId: string;
  clientSecret?: string;
  scope: string[];
  apiUrl: string;
}

export interface DeviceFlowResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url?: string;
  name: string | null;
}

/**
 * Load GitHub configuration from environment.
 * @returns Result containing config or error
 */
export function loadGitHubConfig(): Result<GitHubConfig, GitHubConfigError> {
  const config: GitHubConfig = {
    clientId: process.env.HBD_GITHUB_CLIENT_ID ?? "",
    scope: ["read:user", "user:email"],
    apiUrl: process.env.HBD_GITHUB_API_URL ?? "https://api.github.com",
  };

  if (!config.clientId) {
    return err(new GitHubConfigError("GitHub Client ID not configured"));
  }

  return ok(config);
}

/**
 * Start the GitHub Device Flow authentication.
 * @param config - Optional configuration override
 * @returns Result containing device flow response or error
 */
export async function startDeviceFlow(config?: GitHubConfig): Promise<Result<DeviceFlowResponse, GitHubAuthError | GitHubConfigError>> {
  const cfgResult = config ? ok(config) : loadGitHubConfig();
  if (isErr(cfgResult)) {
    return err(cfgResult.error);
  }
  const cfg = cfgResult.value;

  try {
    const response = await fetch(`${cfg.apiUrl}/login/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: cfg.clientId, scope: cfg.scope.join(" ") }),
    });

    if (!response.ok) {
      return err(new GitHubAuthError(`Device flow failed: ${response.statusText}`));
    }

    const data = await response.json();
    return ok(data);
  } catch (error) {
    return err(new GitHubNetworkError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Poll for GitHub token after user authorizes.
 * @param deviceCode - Device code from startDeviceFlow
 * @param config - Optional configuration override
 * @returns Result containing token response or error
 */
export async function pollForToken(deviceCode: string, config?: GitHubConfig): Promise<Result<TokenResponse, GitHubAuthError | GitHubConfigError>> {
  const cfgResult = config ? ok(config) : loadGitHubConfig();
  if (isErr(cfgResult)) {
    return err(cfgResult.error);
  }
  const cfg = cfgResult.value;

  try {
    const response = await fetch(`${cfg.apiUrl}/login/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    if (!response.ok) {
      return err(new GitHubAuthError(`Token request failed: ${response.statusText}`));
    }

    const result = await response.json();
    
    if (result.error) {
      return err(new GitHubAuthError(result.error));
    }

    return ok(result);
  } catch (error) {
    return err(new GitHubNetworkError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Fetch GitHub user profile using access token.
 * @param accessToken - Access token from pollForToken
 * @param config - Optional configuration override
 * @returns Result containing user profile or error
 */
export async function fetchGitHubUser(accessToken: string, config?: GitHubConfig): Promise<Result<GitHubUser, GitHubAuthError | GitHubConfigError>> {
  const cfgResult = config ? ok(config) : loadGitHubConfig();
  if (isErr(cfgResult)) {
    return err(cfgResult.error);
  }
  const cfg = cfgResult.value;

  try {
    const response = await fetch(`${cfg.apiUrl}/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return err(new GitHubAuthError(`Failed to fetch user: ${response.statusText}`));
    }

    const user = await response.json();
    
    // Save identity for dashboard/CLI persistence
    saveGitHubIdentity(user);
    
    return ok(user);
  } catch (error) {
    return err(new GitHubNetworkError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Save GitHub user profile to local cache.
 */
export function saveGitHubIdentity(user: GitHubUser): void {
  try {
    const configDir = getConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const cachePath = path.join(configDir, "github-identity.json");
    fs.writeFileSync(cachePath, JSON.stringify(user, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save GitHub identity:", error);
  }
}

/**
 * Load GitHub user profile from local cache.
 */
export function loadGitHubIdentity(): GitHubUser | null {
  try {
    const cachePath = path.join(getConfigDir(), "github-identity.json");
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    const content = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(content) as GitHubUser;
  } catch (error) {
    return null;
  }
}

// Helper for type guard
function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

/**
 * Verify if authenticated user is a member of a GitHub organization.
 * @param org - Organization name to check
 * @param accessToken - GitHub access token (uses cached if not provided)
 * @returns Result containing true if member, UnauthorizedError if not
 */
export async function verifyOrgMembership(
  org: string,
  accessToken?: string
): Promise<Result<boolean, Error>> {
  // Get token from cache if not provided
  const token = accessToken || getCachedAccessToken();
  
  if (!token) {
    return err(new UnauthorizedError("GitHub authentication required. Please run 'hbd auth github' first."));
  }

  try {
    // Check org membership via GitHub API
    const response = await fetch(`https://api.github.com/orgs/${org}/memberships/${await getCurrentUserLogin(token)}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (response.status === 204) {
      // 204 = member (including owner)
      return ok(true);
    }

    if (response.status === 404) {
      // 404 = not a member
      return err(new OrgMembershipError(org));
    }

    if (response.status === 401) {
      return err(new UnauthorizedError("Invalid GitHub token. Please re-authenticate."));
    }

    // Other errors
    const errorText = await response.text();
    return err(new Error(`GitHub API error: ${response.status} ${errorText}`));
  } catch (error) {
    return err(new Error(`Network error verifying org membership: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Get cached access token from storage.
 */
function getCachedAccessToken(): string | null {
  try {
    const configDir = getConfigDir();
    const tokenPath = path.join(configDir, "github-token.json");
    if (!fs.existsSync(tokenPath)) {
      return null;
    }
    const content = fs.readFileSync(tokenPath, "utf8");
    const data = JSON.parse(content);
    return data.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Get current user login from token.
 */
async function getCurrentUserLogin(token: string): Promise<string> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return "unknown";
    }
    const user = await response.json();
    return user.login || "unknown";
  } catch {
    return "unknown";
  }
}

