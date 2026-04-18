/**
 * BIP39 Mnemonic service for seed phrase generation and recovery.
 * @packageDocumentation
 * @intent Generate and recover Hypercore secret keys from BIP39 mnemonics.
 * @guarantee Validates 12 or 24-word mnemonics and derives deterministic keys.
 */
/**
 * Word count options for BIP39 mnemonics.
 */
export type MnemonicStrength = 128 | 256;
/**
 * Generate a new BIP39 mnemonic.
 * @param strength - Entropy strength in bits (128 = 12 words, 256 = 24 words)
 * @returns A valid BIP39 mnemonic string
 * @throws Error if strength is invalid
 */
export declare function generateMnemonic(strength?: MnemonicStrength): string;
/**
 * Validate a BIP39 mnemonic.
 * @param mnemonic - The mnemonic to validate
 * @returns true if the mnemonic is valid
 */
export declare function isValidMnemonic(mnemonic: string): boolean;
/**
 * Derive a seed buffer from a mnemonic.
 * @param mnemonic - A valid BIP39 mnemonic
 * @param passphrase - Optional passphrase (default: empty string)
 * @returns A seed buffer suitable for key derivation
 */
export declare function mnemonicToSeed(mnemonic: string, passphrase?: string): Buffer;
/**
 * Interface representing a key pair.
 */
export interface KeyPair {
    publicKey: Buffer;
    privateKey?: Buffer;
}
/**
 * Derive a keypair from a mnemonic using BIP39.
 * @param mnemonic - A valid BIP39 mnemonic
 * @param passphrase - Optional passphrase (default: empty string)
 * @returns A keypair object with public and optional private key
 */
export declare function deriveKeyPair(mnemonic: string, passphrase?: string): KeyPair;
/**
 * Get the public key from a keypair.
 * @param keyPair - A keypair object
 * @returns The public key as a hex string
 */
export declare function getPublicKeyHex(keyPair: KeyPair): string;
/**
 * Get the private key from a keypair.
 * @param keyPair - A keypair object
 * @returns The private key as a hex string
 * @throws Error if no private key is available
 */
export declare function getPrivateKeyHex(keyPair: KeyPair): string;
//# sourceMappingURL=bip39.d.ts.map