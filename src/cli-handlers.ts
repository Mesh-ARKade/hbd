/**
 * CLI command handlers for HBD commands.
 * @packageDocumentation
 */

import { MetadataStore } from "../storage/hyperbee.js";

/**
 * Add a ROM to the catalog.
 */
export async function handleAdd(key: string, data: unknown, store: MetadataStore): Promise<boolean> {
  try {
    await store.open();
    await store.put(key, data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan directory for ROMs.
 */
export async function handleScan(store: MetadataStore): Promise<Array<{ key: string; value: unknown }>> {
  await store.open();
  const results: Array<{ key: string; value: unknown }> = [];
  for await (const [key, value] of store.entries()) {
    results.push({ key, value });
  }
  return results;
}

/**
 * List ROMs by system.
 */
export async function handleList(system: string, store: MetadataStore): Promise<unknown[]> {
  await store.open();
  const results: unknown[] = [];
  for await (const [key, value] of store.entries()) {
    const data = value as Record<string, unknown>;
    if (data.system === system) {
      results.push(value);
    }
  }
  return results;
}

/**
 * Get info for a specific ROM.
 */
export async function handleInfo(key: string, store: MetadataStore): Promise<unknown | null> {
  await store.open();
  return store.get(key);
}

/**
 * Get sync status.
 */
export async function handleSync(store: MetadataStore): Promise<{ publicKey: string; peers: number }> {
  await store.open();
  return {
    publicKey: store.getPublicKey(),
    peers: 0,
  };
}