/**
 * Identity-related errors.
 * @packageDocumentation
 */

/**
 * Error thrown when user is not authorized to perform an action.
 */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Error thrown when organization membership verification fails.
 */
export class OrgMembershipError extends UnauthorizedError {
  constructor(org: string) {
    super(`Curator must be a member of the ${org} organization.`);
    this.name = "OrgMembershipError";
  }
}

/**
 * Error thrown when mnemonic is missing or invalid.
 */
export class MnemonicError extends Error {
  constructor(message: string = "Mnemonic required for initialization.") {
    super(message);
    this.name = "MnemonicError";
  }
}

/**
 * Error thrown when GitHub configuration is invalid.
 */
export class GitHubConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubConfigError";
  }
}

/**
 * Error thrown when GitHub authentication fails.
 */
export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAuthError";
  }
}

/**
 * Error thrown when GitHub network request fails.
 */
export class GitHubNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubNetworkError";
  }
}

/**
 * Error thrown when curator is not authorized to access vault.
 */
export class UnauthorizedCuratorError extends Error {
  constructor(message: string = "Curator not authorized to access vault.") {
    super(message);
    this.name = "UnauthorizedCuratorError";
  }
}
