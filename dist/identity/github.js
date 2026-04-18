import * as fs from "node:fs";
import { getIdentityCachePath, ensureConfigDir } from "./keyStore.js";
/**
 * Default GitHub API URL.
 */
export const DEFAULT_GITHUB_API_URL = "https://api.github.com";
/**
 * Load GitHub configuration (reads env at call time).
 * @returns GitHubConfig from environment variables
 */
export function loadGitHubConfig() {
    return {
        clientId: process.env.HBD_GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.HBD_GITHUB_CLIENT_SECRET,
        scope: ["read:user", "user:email"],
        apiUrl: process.env.HBD_GITHUB_API_URL ?? DEFAULT_GITHUB_API_URL,
    };
}
/**
 * Start the GitHub Device Flow.
 * @param config - Optional GitHub configuration
 * @returns The device flow response with user code and verification URI
 * @throws Error if client ID is not configured
 */
export async function startDeviceFlow(config) {
    const cfg = config ?? loadGitHubConfig();
    const clientId = cfg.clientId || process.env.HBD_GITHUB_CLIENT_ID;
    if (!clientId) {
        throw new Error("GitHub Client ID not configured. Set HBD_GITHUB_CLIENT_ID environment variable.");
    }
    const response = await fetch(`${cfg.apiUrl}/login/device/code`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            scope: cfg.scope.join(" "),
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Device flow failed: ${error}`);
    }
    return response.json();
}
/**
 * Poll for token after user authorizes.
 * @param deviceCode - The device code from startDeviceFlow
 * @param config - Optional GitHub configuration
 * @returns The token response
 * @throws Error if authorization not yet complete or failed
 */
export async function pollForToken(deviceCode, config) {
    const cfg = config ?? loadGitHubConfig();
    const clientId = cfg.clientId || process.env.HBD_GITHUB_CLIENT_ID;
    if (!clientId) {
        throw new Error("GitHub Client ID not configured.");
    }
    const response = await fetch(`${cfg.apiUrl}/login/oauth/access_token`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: cfg.clientSecret,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token poll failed: ${error}`);
    }
    const result = (await response.json());
    if (result.error) {
        throw new Error(`Authorization not completed: ${result.error}`);
    }
    return result;
}
/**
 * Complete the device flow by polling until authorized.
 * @param deviceCode - The device code from startDeviceFlow
 * @param interval - The polling interval in seconds
 * @param config - Optional GitHub configuration
 * @returns The access token
 * @throws Error if authorization fails
 */
export async function completeDeviceFlow(deviceCode, interval, config) {
    const pollInterval = interval * 1000;
    while (true) {
        try {
            const tokenResponse = await pollForToken(deviceCode, config);
            return tokenResponse.access_token;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("authorization_not_complete")) {
                await new Promise((resolve) => setTimeout(resolve, pollInterval));
                continue;
            }
            throw error;
        }
    }
}
/**
 * Fetch user profile from GitHub.
 * @param accessToken - The access token
 * @param config - Optional GitHub configuration
 * @returns The GitHub user profile
 * @throws Error if fetch fails
 */
export async function fetchGitHubUser(accessToken, config) {
    const cfg = config ?? loadGitHubConfig();
    const apiUrl = cfg.apiUrl || process.env.HBD_GITHUB_API_URL || DEFAULT_GITHUB_API_URL;
    const response = await fetch(`${apiUrl}/user`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch user: ${error}`);
    }
    return response.json();
}
/**
 * Cache the GitHub identity to disk.
 * @param identity - The GitHub identity to cache
 */
export function cacheGitHubIdentity(identity) {
    ensureConfigDir();
    fs.writeFileSync(getIdentityCachePath(), JSON.stringify(identity, null, 2), {
        mode: 0o600,
    });
}
/**
 * Load cached GitHub identity.
 * @returns The cached identity or null if not found
 */
export function loadGitHubIdentity() {
    const cachePath = getIdentityCachePath();
    if (!fs.existsSync(cachePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(cachePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Delete the cached identity.
 */
export function clearGitHubIdentity() {
    const cachePath = getIdentityCachePath();
    if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
    }
}
/**
 * Interactive login flow.
 * @returns The authenticated GitHub identity
 */
export async function login() {
    const config = loadGitHubConfig();
    const clientId = config.clientId || process.env.HBD_GITHUB_CLIENT_ID;
    if (!clientId) {
        throw new Error("GitHub Client ID not configured. Set HBD_GITHUB_CLIENT_ID environment variable.");
    }
    // Check if already cached
    const cached = loadGitHubIdentity();
    if (cached && cached.accessToken) {
        return cached;
    }
    // Start device flow
    const deviceFlow = await startDeviceFlow(config);
    console.log("Please visit:", deviceFlow.verification_uri_complete);
    console.log("Enter code:", deviceFlow.user_code);
    console.log("Polling for authorization...");
    // Complete device flow
    const accessToken = await completeDeviceFlow(deviceFlow.device_code, deviceFlow.interval, config);
    // Fetch user profile
    const user = await fetchGitHubUser(accessToken, config);
    const identity = {
        login: user.login,
        id: user.id,
        name: user.name ?? undefined,
        email: user.email ?? undefined,
        avatarUrl: user.avatar_url,
        accessToken,
    };
    // Cache the identity
    cacheGitHubIdentity(identity);
    return identity;
}
/**
 * Get the current authenticated user.
 * @returns The GitHub identity or null if not logged in
 */
export function whoami() {
    return loadGitHubIdentity();
}
//# sourceMappingURL=github.js.map