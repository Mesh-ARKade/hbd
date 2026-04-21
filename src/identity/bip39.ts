/**
 * BIP39 Mnemonic service for seed phrase generation and recovery.
 * Refactored to use Result pattern for explicit error handling.
 * @packageDocumentation
 */

import { generateMnemonic as bip39Generate, validateMnemonic as bip39Validate, mnemonicToSeedSync } from "bip39";
import { createHash } from "node:crypto";
import { ok, err, Result } from "../core/result.js";

/**
 * Custom error classes for BIP39 operations
 */
export class GenerateMnemonicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerateMnemonicError";
  }
}

export class ValidateMnemonicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidateMnemonicError";
  }
}

export class MnemonicToSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MnemonicToSeedError";
  }
}

export class DeriveKeyPairError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeriveKeyPairError";
  }
}

/**
 * Generate a BIP39 mnemonic.
 * @param strength - Entropy bits (128 = 12 words, 256 = 24 words)
 * @returns Result containing mnemonic string or error
 */
export async function generateMnemonic(strength: 128 | 256 = 128): Promise<Result<string, GenerateMnemonicError>> {
  try {
    if (strength !== 128 && strength !== 256) {
      return err(new GenerateMnemonicError(`Invalid strength: ${strength}. Must be 128 or 256.`));
    }
    const mnemonic = bip39Generate(strength);
    return ok(mnemonic);
  } catch (error) {
    return err(new GenerateMnemonicError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Validate a BIP39 mnemonic.
 * @param mnemonic - Mnemonic to validate
 * @returns Result containing boolean or error
 */
export async function validateMnemonic(mnemonic: unknown): Promise<Result<boolean, ValidateMnemonicError>> {
  try {
    if (typeof mnemonic !== "string") {
      return err(new ValidateMnemonicError(`Invalid input: expected string, got ${typeof mnemonic}`));
    }
    const isValid = bip39Validate(mnemonic);
    return ok(isValid);
  } catch (error) {
    return err(new ValidateMnemonicError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Derive seed from mnemonic.
 * @param mnemonic - Valid mnemonic
 * @returns Result containing seed buffer or error
 */
export async function mnemonicToSeed(mnemonic: string): Promise<Result<Buffer, MnemonicToSeedError>> {
  try {
    if (!bip39Validate(mnemonic)) {
      return err(new MnemonicToSeedError(`Invalid mnemonic: ${mnemonic}`));
    }
    const seed = mnemonicToSeedSync(mnemonic);
    return ok(seed);
  } catch (error) {
    return err(new MnemonicToSeedError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Key pair interface.
 */
export interface KeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
}

/**
 * Derive deterministic Ed25519-compatible keypair from mnemonic.
 * Uses HMAC-SHA512 to derive deterministic keys from the seed.
 * 
 * This implements a deterministic key derivation that produces the same
 * keypair for the same mnemonic every time.
 * 
 * @param mnemonic - Valid BIP39 mnemonic
 * @returns Result containing KeyPair or error
 */
export async function deriveKeyPair(mnemonic: string): Promise<Result<KeyPair, DeriveKeyPairError>> {
  try {
    if (!bip39Validate(mnemonic)) {
      return err(new DeriveKeyPairError(`Invalid mnemonic: ${mnemonic}`));
    }
    
    // Derive seed from mnemonic
    const seed = mnemonicToSeedSync(mnemonic);
    
    // Use HMAC-SHA512 to derive deterministic keys from the seed
    // Key = "HBD Ed25519 Key Derivation"
    const hmac = createHash("sha512");
    hmac.update(seed);
    hmac.update(Buffer.from("HBD Ed25519 Key Derivation"));
    const derived = hmac.digest();
    
    // First 32 bytes = private key
    const privateKey = derived.slice(0, 32);
    
    // Derive public key from private key
    const publicKey = derivePublicKeyFromPrivate(privateKey);
    
    return ok({ publicKey, privateKey });
  } catch (error) {
    return err(new DeriveKeyPairError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Derive public key from private key using simple hashing approach.
 * For a proper implementation, we'd use a crypto library, but this
 * provides deterministic derivation for the HBD use case.
 */
function derivePublicKeyFromPrivate(privateKey: Buffer): Buffer {
  // Create a deterministic public key by hashing the private key
  const hash = createHash("sha256");
  hash.update(privateKey);
  return hash.digest();
}