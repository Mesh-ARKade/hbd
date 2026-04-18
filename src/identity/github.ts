/**
 * GitHub Device Flow authentication service.
 * @packageDocumentation
 */

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

export function loadGitHubConfig(): GitHubConfig {
  return {
    clientId: process.env.HBD_GITHUB_CLIENT_ID ?? "",
    scope: ["read:user", "user:email"],
    apiUrl: process.env.HBD_GITHUB_API_URL ?? "https://api.github.com",
  };
}

export async function startDeviceFlow(config?: GitHubConfig): Promise<DeviceFlowResponse> {
  const cfg = config ?? loadGitHubConfig();
  if (!cfg.clientId) {
    throw new Error("GitHub Client ID not configured");
  }

  const response = await fetch(`${cfg.apiUrl}/login/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, scope: cfg.scope.join(" ") }),
  });

  if (!response.ok) {
    throw new Error(`Device flow failed: ${response.statusText}`);
  }

  return response.json();
}

export async function pollForToken(deviceCode: string, config?: GitHubConfig): Promise<TokenResponse> {
  const cfg = config ?? loadGitHubConfig();
  if (!cfg.clientId) {
    throw new Error("GitHub Client ID not configured");
  }

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
    throw new Error(`Token request failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}

export async function fetchGitHubUser(accessToken: string, config?: GitHubConfig): Promise<GitHubUser> {
  const cfg = config ?? loadGitHubConfig();
  const response = await fetch(`${cfg.apiUrl}/user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }

  return response.json();
}