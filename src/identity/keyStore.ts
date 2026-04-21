/**
 * KeyStore - Secure local storage for BIP39 mnemonics and derived keys.
 * @packageDocumentation
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ok, err, Result } from "../core/result.js";

/**
 * Keystore structure.
 */
export interface KeystoreData {
  mnemonic: string;
  publicKey: string;
  createdAt: number;
}

/**
 * Error classes for Keystore.
 */
export class KeystoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeystoreError";
  }
}

/**
 * Get the path to the local config directory.
 */
export function getConfigDir(): string {
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "hbd");
  }
  return path.join(home, ".hbd");
}

/**
 * Get the path to the keystore file.
 */
export function getKeystorePath(dataDir?: string): string {
  if (dataDir) {
    return path.join(dataDir, "keystore.json");
  }
  return path.join(getConfigDir(), "keystore.json");
}

/**
 * Save identity to the local keystore.
 */
export async function saveIdentity(
  mnemonic: string,
  publicKey: string,
  dataDir?: string
): Promise<Result<void, KeystoreError>> {
  try {
    const storePath = getKeystorePath(dataDir);
    const storeDir = path.dirname(storePath);

    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }

    const data: KeystoreData = {
      mnemonic,
      publicKey,
      createdAt: Date.now(),
    };

    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf8");
    return ok(undefined);
  } catch (error) {
    return err(new KeystoreError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Load identity from the local keystore.
 */
export async function loadIdentity(dataDir?: string): Promise<Result<KeystoreData | null, KeystoreError>> {
  try {
    const storePath = getKeystorePath(dataDir);

    if (!fs.existsSync(storePath)) {
      return ok(null);
    }

    const content = fs.readFileSync(storePath, "utf8");
    const data = JSON.parse(content) as KeystoreData;
    return ok(data);
  } catch (error) {
    return err(new KeystoreError(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Clear the local identity.
 */
export async function clearIdentity(dataDir?: string): Promise<Result<void, KeystoreError>> {
  try {
    const storePath = getKeystorePath(dataDir);
    if (fs.existsSync(storePath)) {
      fs.unlinkSync(storePath);
    }
    return ok(undefined);
  } catch (error) {
    return err(new KeystoreError(error instanceof Error ? error.message : String(error)));
  }
}
