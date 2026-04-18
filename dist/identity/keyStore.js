import * as fs from "node:fs";
import * as path from "node:path";
import { deriveKeyPair, getPrivateKeyHex, getPublicKeyHex } from "./bip39.js";
/**
 * Secure key storage module for Hypercore Secret Keys.
 * @packageDocumentation
 * @intent Store and retrieve Hypercore keypairs from encrypted .env storage.
 * @guarantee Private keys are never logged or exposed to stdout.
 */
/**
 * Get the HBD configuration directory.
 */
export function getHbdConfigDir() {
    return process.env.HBD_CONFIG_DIR ?? path.join(process.env.HOME ?? ".", ".hbd");
}
/**
 * Get the key store file path.
 */
export function getKeystorePath() {
    return path.join(getHbdConfigDir(), "keys.env");
}
/**
 * Get the identity cache file path.
 */
export function getIdentityCachePath() {
    return path.join(getHbdConfigDir(), "identity.json");
}
/**
 * @deprecated Use getHbdConfigDir() instead
 */
export const HBD_CONFIG_DIR = getHbdConfigDir();
/**
 * @deprecated Use getKeystorePath() instead
 */
export const KEYSTORE_PATH = getKeystorePath();
/**
 * @deprecated Use getIdentityCachePath() instead
 */
export const IDENTITY_CACHE_PATH = getIdentityCachePath();
/**
 * Ensure the HBD config directory exists.
 */
export function ensureConfigDir() {
    const dir = getHbdConfigDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { mode: 0o700 });
    }
}
/**
 * Check if keystore exists.
 * @returns true if the keystore file exists
 */
export function hasKeystore() {
    return fs.existsSync(getKeystorePath());
}
/**
 * Load the keystore from disk.
 * @returns The keystore data or null if not found
 * @throws Error if the keystore is corrupted
 */
export function loadKeystore() {
    const storePath = getKeystorePath();
    if (!fs.existsSync(storePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(storePath, "utf-8");
        const lines = {};
        for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
                continue;
            }
            const [key, ...valueParts] = trimmed.split("=");
            if (key && valueParts.length > 0) {
                lines[key.trim()] = valueParts.join("=").trim();
            }
        }
        return {
            HC_PUBLIC_KEY: lines.HC_PUBLIC_KEY,
            HC_SECRET_KEY: lines.HC_SECRET_KEY,
            HC_MNEMONIC: lines.HC_MNEMONIC,
        };
    }
    catch (error) {
        throw new Error(`Failed to load keystore: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
/**
 * Save the keystore to disk.
 * @param data - The keystore data to save
 */
export function saveKeystore(data) {
    ensureConfigDir();
    const storePath = getKeystorePath();
    const lines = [
        "# HBD Keystore - DO NOT SHARE",
        `HC_PUBLIC_KEY=${data.HC_PUBLIC_KEY}`,
    ];
    if (data.HC_SECRET_KEY) {
        lines.push(`HC_SECRET_KEY=${data.HC_SECRET_KEY}`);
    }
    if (data.HC_MNEMONIC) {
        lines.push(`HC_MNEMONIC=${data.HC_MNEMONIC}`);
    }
    fs.writeFileSync(storePath, lines.join("\n"), { mode: 0o600 });
}
/**
 * Derive and store a new keypair from a mnemonic.
 * @param mnemonic - A valid BIP39 mnemonic
 * @param storeMnemonic - Whether to store the mnemonic (false by default for security)
 * @returns The derived keypair
 */
export function storeKeypairFromMnemonic(mnemonic, storeMnemonic = false) {
    const keyPair = deriveKeyPair(mnemonic);
    const publicKeyHex = getPublicKeyHex(keyPair);
    const privateKeyHex = keyPair.privateKey ? getPrivateKeyHex(keyPair) : undefined;
    saveKeystore({
        HC_PUBLIC_KEY: publicKeyHex,
        HC_SECRET_KEY: privateKeyHex,
        HC_MNEMONIC: storeMnemonic ? mnemonic : undefined,
    });
    return keyPair;
}
/**
 * Load the keypair from the keystore.
 * @returns The keypair or null if not found
 */
export function loadKeypair() {
    const keystore = loadKeystore();
    if (!keystore) {
        return null;
    }
    return {
        publicKey: Buffer.from(keystore.HC_PUBLIC_KEY, "hex"),
        privateKey: keystore.HC_SECRET_KEY ? Buffer.from(keystore.HC_SECRET_KEY, "hex") : undefined,
    };
}
/**
 * Get the public key from the keystore.
 * @returns The public key as a hex string or null if not configured
 */
export function getPublicKey() {
    const keystore = loadKeystore();
    return keystore?.HC_PUBLIC_KEY ?? null;
}
/**
 * Check if we have a secret key (seeder mode).
 * @returns true if secret key is available
 */
export function hasSecretKey() {
    const keystore = loadKeystore();
    return !!keystore?.HC_SECRET_KEY;
}
/**
 * Delete the keystore.
 * WARNING: This is destructive and cannot be undone.
 */
export function deleteKeystore() {
    const storePath = getKeystorePath();
    if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
    }
}
//# sourceMappingURL=keyStore.js.map