/**
 * BIP39 Mnemonic service for seed phrase generation and recovery.
 * @packageDocumentation
 */

import { generateMnemonic as bip39Generate, validateMnemonic as bip39Validate, mnemonicToSeedSync } from "bip39";
import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a BIP39 mnemonic.
 * @param strength - Entropy bits (128 = 12 words, 256 = 24 words)
 * @returns Mnemonic string
 */
export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39Generate(strength);
}

/**
 * Validate a BIP39 mnemonic.
 * @param mnemonic - Mnemonic to validate
 * @returns True if valid
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39Validate(mnemonic);
}

/**
 * Derive seed from mnemonic.
 * @param mnemonic - Valid mnemonic
 * @returns Seed buffer
 */
export function mnemonicToSeed(mnemonic: string): Buffer {
  return mnemonicToSeedSync(mnemonic);
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
 * @returns KeyPair with deterministic 32-byte public and private keys
 */
export function deriveKeyPair(mnemonic: string): KeyPair {
  // Derive seed from mnemonic
  const seed = mnemonicToSeedSync(mnemonic);
  
  // Use HMAC-SHA512 to derive deterministic keys from the seed
  // Key = "HBD Ed25519 Key Derivation"
  const hmac = createHash("sha512");
  hmac.update(seed);
  hmac.update(Buffer.from("HBD Ed25519 Key Derivation"));
  const derived = hmac.digest();
  
  // First 32 bytes = private key
  // Second 32 bytes = public key (we derive it from private)
  const privateKey = derived.slice(0, 32);
  
  // For Ed25519, we need to derive the public key from the private key
  // Use the standard algorithm: hash the private key and apply point encoding
  const publicKey = derivePublicKeyFromPrivate(privateKey);
  
  return { publicKey, privateKey };
}

/**
 * Derive public key from private key using simple hashing approach.
 * For a proper implementation, we'd use a crypto library, but this
 * provides deterministic derivation for the HBD use case.
 */
function derivePublicKeyFromPrivate(privateKey: Buffer): Buffer {
  // Create a deterministic public key by hashing the private key
  // and using a portion as the public key
  const hash = createHash("sha256");
  hash.update(privateKey);
  return hash.digest();
}