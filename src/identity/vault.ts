/**
 * VaultService - GitHub Vault Integration for Writer Keys
 * Fetches curator-specific secret keys from the private hbd-writer-key repository
 * @packageDocumentation
 */

import { ok, err, Result } from "../core/result.js";
import { UnauthorizedCuratorError } from "./errors.js";

/**
 * Error thrown when the vault key is expired or invalid
 */
export class VaultKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultKeyError";
  }
}

/**
 * Writer key data structure from vault
 */
export interface WriterKey {
  username: string;
  publicKey: string;
  secretKey: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Options for VaultService
 */
export interface VaultServiceOptions {
  /** GitHub repository owner */
  repoOwner: string;
  /** GitHub repository name */
  repoName: string;
  /** GitHub API base URL */
  apiUrl?: string;
}

/**
 * Service for fetching and caching writer keys from GitHub Vault
 */
export class VaultService {
  private repoOwner: string;
  private repoName: string;
  private apiUrl: string;
  private keyCache: Map<string, { key: WriterKey; fetchedAt: number }> = new Map();
  private cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(options: VaultServiceOptions) {
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    this.apiUrl = options.apiUrl ?? "https://api.github.com";
  }

  /**
   * Fetch writer key for a specific curator from the GitHub vault
   */
  async getKeyWithCache(
    username: string,
    accessToken: string
  ): Promise<Result<WriterKey, Error>> {
    const cacheKey = `${username}:${accessToken.slice(0, 8)}`;
    const cached = this.keyCache.get(cacheKey);

    // Check if cached key is still valid
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      const validation = this.validateKey(cached.key);
      if (validation.ok) {
        return ok(cached.key);
      }
      // Cached key expired, remove it
      this.keyCache.delete(cacheKey);
    }

    // Fetch fresh key
    const result = await fetchWriterKey(username, accessToken, {
      repoOwner: this.repoOwner,
      repoName: this.repoName,
      apiUrl: this.apiUrl,
    });

    if (result.ok) {
      // Validate before caching
      const validation = this.validateKey(result.value);
      if (!validation.ok) {
        return validation;
      }

      // Cache the valid key
      this.keyCache.set(cacheKey, {
        key: result.value,
        fetchedAt: Date.now(),
      });
    }

    return result;
  }

  /**
   * Validate a writer key (check expiration and required fields)
   */
  validateKey(key: WriterKey): Result<WriterKey, Error> {
    // Check required fields
    if (!key.username || !key.publicKey || !key.secretKey) {
      return err(new VaultKeyError("Invalid key data: missing required fields"));
    }

    // Check expiration
    if (key.expiresAt) {
      const expiresAt = new Date(key.expiresAt).getTime();
      if (Date.now() > expiresAt) {
        return err(
          new VaultKeyError(
            `Key expired on ${new Date(key.expiresAt).toISOString()}. Please request a new key.`
          )
        );
      }
    }

    return ok(key);
  }

  /**
   * Clear the key cache
   */
  clearCache(): void {
    this.keyCache.clear();
  }
}

/**
 * Fetch writer key directly from GitHub vault repository
 */
export async function fetchWriterKey(
  username: string,
  accessToken: string,
  options: {
    repoOwner: string;
    repoName: string;
    apiUrl?: string;
  }
): Promise<Result<WriterKey, Error>> {
  const apiUrl = options.apiUrl ?? "https://api.github.com";
  const filePath = `keys/${username}.json`;

  try {
    const response = await fetch(
      `${apiUrl}/repos/${options.repoOwner}/${options.repoName}/contents/${filePath}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "HBD-Vault-Service",
        },
      }
    );

    if (response.status === 404) {
      return err(
        new UnauthorizedCuratorError(`Curator '${username}' is not authorized to access the vault.`)
      );
    }

    if (response.status === 401) {
      return err(
        new Error("GitHub authentication failed. Please re-authenticate.")
      );
    }

    if (response.status === 403) {
      return err(
        new Error(
          `Access forbidden. Ensure you are a member of the ${options.repoOwner} organization.`
        )
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return err(
        new Error(`GitHub API error (${response.status}): ${errorText}`)
      );
    }

    const data = await response.json();

    // GitHub returns content as base64
    if (!data.content) {
      return err(new Error("Invalid response from vault: missing content"));
    }

    // Decode base64 content
    const decodedContent = Buffer.from(data.content, "base64").toString("utf-8");
    const keyData: WriterKey = JSON.parse(decodedContent);

    // Verify the username matches
    if (keyData.username !== username) {
      return err(
        new Error("Key username mismatch. Contact vault administrator.")
      );
    }

    return ok(keyData);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return err(new Error("Invalid JSON in vault key file"));
    }
    return err(
      new Error(
        `Network error accessing vault: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
  }
}
