import { generateMnemonic as bip39GenerateMnemonic, validateMnemonic, mnemonicToSeedSync, } from "bip39";
import { ECPairFactory } from "ecpair";
import * as tinysecp256k1 from "tiny-secp256k1";
/**
 * Generate a new BIP39 mnemonic.
 * @param strength - Entropy strength in bits (128 = 12 words, 256 = 24 words)
 * @returns A valid BIP39 mnemonic string
 * @throws Error if strength is invalid
 */
export function generateMnemonic(strength = 128) {
    if (strength !== 128 && strength !== 256) {
        throw new Error("Strength must be 128 (12 words) or 256 (24 words)");
    }
    return bip39GenerateMnemonic(strength);
}
/**
 * Validate a BIP39 mnemonic.
 * @param mnemonic - The mnemonic to validate
 * @returns true if the mnemonic is valid
 */
export function isValidMnemonic(mnemonic) {
    return validateMnemonic(mnemonic);
}
/**
 * Derive a seed buffer from a mnemonic.
 * @param mnemonic - A valid BIP39 mnemonic
 * @param passphrase - Optional passphrase (default: empty string)
 * @returns A seed buffer suitable for key derivation
 */
export function mnemonicToSeed(mnemonic, passphrase = "") {
    return mnemonicToSeedSync(mnemonic, passphrase);
}
/**
 * Derive a keypair from a mnemonic using BIP39.
 * @param mnemonic - A valid BIP39 mnemonic
 * @param passphrase - Optional passphrase (default: empty string)
 * @returns A keypair object with public and optional private key
 */
export function deriveKeyPair(mnemonic, passphrase = "") {
    const seed = mnemonicToSeed(mnemonic, passphrase);
    const ecpair = ECPairFactory(tinysecp256k1);
    const keyPair = ecpair.fromPrivateKey(seed.slice(0, 32));
    return {
        publicKey: Buffer.from(keyPair.publicKey),
        privateKey: keyPair.privateKey ? Buffer.from(keyPair.privateKey) : undefined,
    };
}
/**
 * Get the public key from a keypair.
 * @param keyPair - A keypair object
 * @returns The public key as a hex string
 */
export function getPublicKeyHex(keyPair) {
    return keyPair.publicKey.toString("hex");
}
/**
 * Get the private key from a keypair.
 * @param keyPair - A keypair object
 * @returns The private key as a hex string
 * @throws Error if no private key is available
 */
export function getPrivateKeyHex(keyPair) {
    if (!keyPair.privateKey) {
        throw new Error("No private key available");
    }
    return keyPair.privateKey.toString("hex");
}
//# sourceMappingURL=bip39.js.map