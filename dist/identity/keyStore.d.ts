import { type KeyPair } from "./bip39.js";
/**
 * Secure key storage module for Hypercore Secret Keys.
 * @packageDocumentation
 * @intent Store and retrieve Hypercore keypairs from encrypted .env storage.
 * @guarantee Private keys are never logged or exposed to stdout.
 */
/**
 * Get the HBD configuration directory.
 */
export declare function getHbdConfigDir(): string;
/**
 * Get the key store file path.
 */
export declare function getKeystorePath(): string;
/**
 * Get the identity cache file path.
 */
export declare function getIdentityCachePath(): string;
/**
 * @deprecated Use getHbdConfigDir() instead
 */
export declare const HBD_CONFIG_DIR: string;
/**
 * @deprecated Use getKeystorePath() instead
 */
export declare const KEYSTORE_PATH: string;
/**
 * @deprecated Use getIdentityCachePath() instead
 */
export declare const IDENTITY_CACHE_PATH: string;
/**
 * Interface for the keystore file format.
 */
export interface KeystoreFormat {
    /**
     * The Hypercore public key (hex encoded).
     */
    HC_PUBLIC_KEY: string;
    /**
     * The Hypercore secret key (hex encoded), only present if seeder mode.
     */
    HC_SECRET_KEY?: string;
    /**
     * The mnemonic used to derive the keys (optional - user may not want to store this).
     */
    HC_MNEMONIC?: string;
}
/**
 * Ensure the HBD config directory exists.
 */
export declare function ensureConfigDir(): void;
/**
 * Check if keystore exists.
 * @returns true if the keystore file exists
 */
export declare function hasKeystore(): boolean;
/**
 * Load the keystore from disk.
 * @returns The keystore data or null if not found
 * @throws Error if the keystore is corrupted
 */
export declare function loadKeystore(): KeystoreFormat | null;
/**
 * Save the keystore to disk.
 * @param data - The keystore data to save
 */
export declare function saveKeystore(data: KeystoreFormat): void;
/**
 * Derive and store a new keypair from a mnemonic.
 * @param mnemonic - A valid BIP39 mnemonic
 * @param storeMnemonic - Whether to store the mnemonic (false by default for security)
 * @returns The derived keypair
 */
export declare function storeKeypairFromMnemonic(mnemonic: string, storeMnemonic?: boolean): KeyPair;
/**
 * Load the keypair from the keystore.
 * @returns The keypair or null if not found
 */
export declare function loadKeypair(): KeyPair | null;
/**
 * Get the public key from the keystore.
 * @returns The public key as a hex string or null if not configured
 */
export declare function getPublicKey(): string | null;
/**
 * Check if we have a secret key (seeder mode).
 * @returns true if secret key is available
 */
export declare function hasSecretKey(): boolean;
/**
 * Delete the keystore.
 * WARNING: This is destructive and cannot be undone.
 */
export declare function deleteKeystore(): void;
//# sourceMappingURL=keyStore.d.ts.map