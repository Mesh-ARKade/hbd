/**
 * GitHub Device Flow authentication service.
 * Refactored to use Result pattern for explicit error handling.
 * @packageDocumentation
 */

import { ok, err, Result } from "../core/result.js";
import { GitHubConfigError, GitHubAuthError, GitHubNetworkError } from "./errors.js";

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
    return ok(user);
  } catch (error) {
    return err(new GitHubNetworkError(error instanceof Error ? error.message : String(error)));
  }
}

// Helper for type guard
function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}