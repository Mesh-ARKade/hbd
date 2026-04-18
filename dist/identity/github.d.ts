/**
 * GitHub OAuth/Device Flow authentication service.
 * @packageDocumentation
 * @intent Authenticate curators via GitHub Device Flow for operation attribution.
 * @guarantee Secure token storage and identity caching.
 */
/**
 * GitHub OAuth configuration.
 * Override via environment variables for custom GitHub Enterprise.
 */
export interface GitHubConfig {
    clientId: string;
    clientSecret?: string;
    scope: string[];
    apiUrl: string;
}
/**
 * Default GitHub API URL.
 */
export declare const DEFAULT_GITHUB_API_URL = "https://api.github.com";
/**
 * Load GitHub configuration (reads env at call time).
 * @returns GitHubConfig from environment variables
 */
export declare function loadGitHubConfig(): GitHubConfig;
/**
 * Interface for cached GitHub identity.
 */
export interface GitHubIdentity {
    login: string;
    id: number;
    name?: string;
    email?: string;
    avatarUrl: string;
    accessToken: string;
    expiresAt?: number;
}
/**
 * Device flow response from GitHub.
 */
export interface DeviceFlowResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
}
/**
 * Token response from GitHub.
 */
export interface TokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
    expires_in?: number;
    refresh_token?: string;
}
/**
 * GitHub user response.
 */
export interface GitHubUser {
    login: string;
    id: number;
    name: string | null;
    email: string | null;
    avatar_url: string;
}
/**
 * Start the GitHub Device Flow.
 * @param config - Optional GitHub configuration
 * @returns The device flow response with user code and verification URI
 * @throws Error if client ID is not configured
 */
export declare function startDeviceFlow(config?: GitHubConfig): Promise<DeviceFlowResponse>;
/**
 * Poll for token after user authorizes.
 * @param deviceCode - The device code from startDeviceFlow
 * @param config - Optional GitHub configuration
 * @returns The token response
 * @throws Error if authorization not yet complete or failed
 */
export declare function pollForToken(deviceCode: string, config?: GitHubConfig): Promise<TokenResponse>;
/**
 * Complete the device flow by polling until authorized.
 * @param deviceCode - The device code from startDeviceFlow
 * @param interval - The polling interval in seconds
 * @param config - Optional GitHub configuration
 * @returns The access token
 * @throws Error if authorization fails
 */
export declare function completeDeviceFlow(deviceCode: string, interval: number, config?: GitHubConfig): Promise<string>;
/**
 * Fetch user profile from GitHub.
 * @param accessToken - The access token
 * @param config - Optional GitHub configuration
 * @returns The GitHub user profile
 * @throws Error if fetch fails
 */
export declare function fetchGitHubUser(accessToken: string, config?: GitHubConfig): Promise<GitHubUser>;
/**
 * Cache the GitHub identity to disk.
 * @param identity - The GitHub identity to cache
 */
export declare function cacheGitHubIdentity(identity: GitHubIdentity): void;
/**
 * Load cached GitHub identity.
 * @returns The cached identity or null if not found
 */
export declare function loadGitHubIdentity(): GitHubIdentity | null;
/**
 * Delete the cached identity.
 */
export declare function clearGitHubIdentity(): void;
/**
 * Interactive login flow.
 * @returns The authenticated GitHub identity
 */
export declare function login(): Promise<GitHubIdentity>;
/**
 * Get the current authenticated user.
 * @returns The GitHub identity or null if not logged in
 */
export declare function whoami(): GitHubIdentity | null;
//# sourceMappingURL=github.d.ts.map