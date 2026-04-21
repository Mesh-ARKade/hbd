/**
 * CLI command handlers for HBD commands.
 * Refactored to enforce Identity-First flow (BIP39 -> KeyStore -> MetadataStore).
 * @packageDocumentation
 */

import { MetadataStore } from "./storage/hyperbee.js";
import { ok, err, Result, isErr } from "./core/result.js";
import { loadIdentity, saveIdentity, KeystoreData } from "./identity/keyStore.js";
import { generateMnemonic, deriveKeyPair } from "./identity/bip39.js";
import { Logger } from "pino";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Helper to ensure identity is loaded before store operation.
 */
async function ensureIdentity(dataDir: string): Promise<Result<KeystoreData, Error>> {
  const identityResult = await loadIdentity(dataDir);
  if (isErr(identityResult)) return err(identityResult.error);
  
  if (!identityResult.value) {
    return err(new Error("Identity not initialized. Please provide a public key or run 'hbd init' first."));
  }
  
  return ok(identityResult.value);
}

/**
 * Add a ROM to the catalog.
 */
export async function handleAdd(
  key: string, 
  data: unknown, 
  store: MetadataStore,
  logger?: Logger
): Promise<Result<boolean, Error>> {
  try {
    if (logger) {
      logger.info({ key }, "Add command started");
    }
    
    const identityResult = await ensureIdentity(store.getDataDir());
    if (isErr(identityResult)) return err(identityResult.error);

    const openResult = await store.open(identityResult.value.publicKey);
    if (!openResult.ok) {
      if (logger) {
        logger.error({ key, error: openResult.error.message }, "Add failed: store open error");
      }
      return err(openResult.error);
    }

    const putResult = await store.put(key, data);
    if (!putResult.ok) {
      if (logger) {
        logger.error({ key, error: putResult.error.message }, "Add failed: put error");
      }
      return err(putResult.error);
    }

    if (logger) {
      logger.info({ key }, "Add command completed");
    }
    return ok(true);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ key, error: errMsg }, "Add command failed");
    }
    return err(new Error(errMsg));
  }
}

/**
 * Scan directory for ROMs.
 */
export async function handleScan(
  store: MetadataStore,
  logger?: Logger
): Promise<Result<Array<{ key: string; value: unknown }>, Error>> {
  try {
    if (logger) {
      logger.info("Scan command started");
    }
    
    const identityResult = await ensureIdentity(store.getDataDir());
    if (isErr(identityResult)) return err(identityResult.error);

    const openResult = await store.open(identityResult.value.publicKey);
    if (!openResult.ok) {
      if (logger) {
        logger.error({ error: openResult.error.message }, "Scan failed: store open error");
      }
      return err(openResult.error);
    }

    const results: Array<{ key: string; value: unknown }> = [];
    for await (const [key, value] of store.entries()) {
      results.push({ key, value });
    }

    if (logger) {
      logger.info({ count: results.length }, "Scan command completed");
    }
    return ok(results);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ error: errMsg }, "Scan command failed");
    }
    return err(new Error(errMsg));
  }
}

/**
 * List ROMs by system.
 */
export async function handleList(
  system: string, 
  store: MetadataStore,
  logger?: Logger
): Promise<Result<unknown[], Error>> {
  try {
    if (logger) {
      logger.info({ system }, "List command started");
    }
    
    const identityResult = await ensureIdentity(store.getDataDir());
    if (isErr(identityResult)) return err(identityResult.error);

    const openResult = await store.open(identityResult.value.publicKey);
    if (!openResult.ok) {
      if (logger) {
        logger.error({ system, error: openResult.error.message }, "List failed: store open error");
      }
      return err(openResult.error);
    }

    const results: unknown[] = [];
    for await (const [key, value] of store.entries()) {
      const data = value as Record<string, unknown>;
      if (data.system === system) {
        results.push(value);
      }
    }

    if (logger) {
      logger.info({ system, count: results.length }, "List command completed");
    }
    return ok(results);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ system, error: errMsg }, "List command failed");
    }
    return err(new Error(errMsg));
  }
}

/**
 * Get info for a specific ROM.
 */
export async function handleInfo(
  key: string, 
  store: MetadataStore,
  logger?: Logger
): Promise<Result<unknown | null, Error>> {
  try {
    if (logger) {
      logger.info({ key }, "Info command started");
    }
    
    const identityResult = await ensureIdentity(store.getDataDir());
    if (isErr(identityResult)) return err(identityResult.error);

    const openResult = await store.open(identityResult.value.publicKey);
    if (!openResult.ok) {
      if (logger) {
        logger.error({ key, error: openResult.error.message }, "Info failed: store open error");
      }
      return err(openResult.error);
    }

    const value = await store.get(key);
    
    if (logger) {
      logger.info({ key }, "Info command completed");
    }
    return ok(value);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ key, error: errMsg }, "Info command failed");
    }
    return err(new Error(errMsg));
  }
}

/**
 * Get sync status.
 */
export async function handleSync(
  store: MetadataStore,
  logger?: Logger
): Promise<Result<{ publicKey: string; peers: number }, Error>> {
  try {
    if (logger) {
      logger.info("Sync command started");
    }
    
    const identityResult = await ensureIdentity(store.getDataDir());
    if (isErr(identityResult)) return err(identityResult.error);

    const openResult = await store.open(identityResult.value.publicKey);
    if (!openResult.ok) {
      if (logger) {
        logger.error({ error: openResult.error.message }, "Sync failed: store open error");
      }
      return err(openResult.error);
    }

    const status = {
      publicKey: store.getPublicKey(),
      peers: 0,
    };

    if (logger) {
      logger.info({ publicKey: status.publicKey }, "Sync command completed");
    }
    return ok(status);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ error: errMsg }, "Sync command failed");
    }
    return err(new Error(errMsg));
  }
}

/**
 * Initialize a new HBD store with a BIP39 mnemonic.
 */
export async function handleInit(
  store: MetadataStore,
  logger?: Logger,
  options: { mnemonic?: string } = {}
): Promise<Result<{ publicKey: string; mnemonic: string }, Error>> {
  try {
    if (logger) {
      logger.info("Init command started");
    }

    // 1. Get or generate mnemonic
    let mnemonic = options.mnemonic;
    if (!mnemonic) {
      const genResult = await generateMnemonic(256); // 24 words
      if (isErr(genResult)) return err(genResult.error);
      mnemonic = genResult.value;
    }

    // 2. Derive keypair
    const keyPairResult = await deriveKeyPair(mnemonic);
    if (isErr(keyPairResult)) return err(keyPairResult.error);
    const { publicKey } = keyPairResult.value;
    const publicKeyHex = publicKey.toString("hex");

    // 3. Save to KeyStore
    const saveResult = await saveIdentity(mnemonic, publicKeyHex, store.getDataDir());
    if (isErr(saveResult)) return err(saveResult.error);

    // 4. Open store with derived key
    const result = await store.open(publicKeyHex);
    if (!result.ok) {
      if (logger) {
        logger.error({ error: result.error.message }, "Init failed");
      }
      return err(result.error);
    }

    if (logger) {
      logger.info({ publicKey: result.value }, "Init command completed");
    }
    return ok({ publicKey: result.value, mnemonic });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ error: errMsg }, "Init command failed");
    }
    return err(new Error(errMsg));
  }
}

// Import dashboard components dynamically to avoid circular dependencies
const { DashboardServer } = await import("./dashboard/server.js");
const { PipelineStatus } = await import("./dashboard/pipeline-status.js");
const { LogBridge } = await import("./dashboard/log-bridge.js");

/**
 * Dashboard options.
 */
export interface DashboardOptions {
  dataDir: string;
  port?: number;
  host?: string;
}

/**
 * Start the HBD dashboard server.
 */
export async function handleDashboard(
  options: DashboardOptions,
  logger?: Logger
): Promise<Result<{ url: string; port: number; close: () => Promise<void>; pipeline: any; logBridge: any }, Error>> {
  try {
    if (logger) {
      logger.info({ port: options.port, dataDir: options.dataDir }, "Dashboard command started");
    }

    const dataDir = path.resolve(options.dataDir);
    
    // Check if data directory exists
    if (!fs.existsSync(dataDir)) {
      const error = new Error(`Data directory does not exist: ${dataDir}`);
      if (logger) {
        logger.error({ dataDir, error: error.message }, "Dashboard failed: directory not found");
      }
      return err(error);
    }

    // Create PipelineStatus for state management
    const pipeline = new PipelineStatus({
      broadcast: (state) => {
        // Broadcast will be wired after server starts
      },
    });

    // Create LogBridge for log streaming
    const logBridge = new LogBridge({
      broadcast: (logEntry) => {
        // Broadcast will be wired after server starts
      },
    });

    // Create and start dashboard server
    const server = new DashboardServer({
      dataDir,
      port: options.port ?? 3000,
      host: options.host ?? "localhost",
      logger: logger?.child({ system: "dashboard" }),
    });

    const url = await server.start();
    const port = server.getActualPort() ?? options.port ?? 3000;

    // Wire up broadcasting after server is started
    pipeline["broadcast"] = (state: unknown) => {
      server.broadcastState(state);
    };

    logBridge["broadcast"] = (logEntry: unknown) => {
      server.broadcastLog(logEntry);
    };

    if (logger) {
      logger.info({ url, port }, "Dashboard available");
    }

    return ok({
      url,
      port,
      close: async () => {
        await server.close();
        if (logger) {
          logger.info("Dashboard server closed");
        }
      },
      pipeline,
      logBridge,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ error: errMsg }, "Dashboard command failed");
    }
    return err(new Error(errMsg));
  }
}

// Import NoIntroScraper dynamically to avoid circular dependencies
const { NoIntroScraper } = await import("./scrapers/sources/nointro.js");

/**
 * Options for scrape command.
 */
export interface ScrapeOptions {
  dataDir: string;
  system?: string;
  pipeline?: {
    update: (phase: string, progress?: number, message?: string) => void;
  };
}

/**
 * Scrape metadata from No-Intro.
 * If dashboard is running, sends request to the API instead of running locally.
 */
export async function handleScrape(
  options: ScrapeOptions,
  logger?: Logger
): Promise<Result<{ success: true; recordsProcessed: number }, Error>> {
  try {
    if (logger) {
      logger.info({ dataDir: options.dataDir, system: options.system }, "Scrape command started");
    }

    const dataDir = path.resolve(options.dataDir);

    // Check if data directory exists
    if (!fs.existsSync(dataDir)) {
      const error = new Error(`Data directory does not exist: ${dataDir}`);
      if (logger) {
        logger.error({ dataDir, error: error.message }, "Scrape failed: directory not found");
      }
      return err(error);
    }
    
    const identityResult = await ensureIdentity(dataDir);
    if (isErr(identityResult)) return err(identityResult.error);

    // Check if dashboard is running on default port (3000)
    const { isDashboardRunning, sendScrapeRequest } = await import("./cli-proxy.js");
    const dashboardRunning = await isDashboardRunning(3000);

    if (dashboardRunning) {
      if (logger) {
        logger.info("Dashboard detected, using queue API");
      }

      // Use dashboard API
      const sourceId = options.system || "all";
      const result = await sendScrapeRequest(sourceId, 3000);

      if (result.ok) {
        if (logger) {
          logger.info({ message: result.value.message }, "Scrape queued via dashboard");
        }
        return ok({
          success: true,
          recordsProcessed: 0, // Will be processed by dashboard
        });
      } else {
        if (logger) {
          logger.error({ error: result.error.message }, "Dashboard API failed");
        }
        return err(result.error);
      }
    }

    // Parse systems if provided
    const systems = options.system ? options.system.split(",") : ["all"];
    if (logger) {
      logger.info({ systems }, `Scraping ${systems.length} system(s)`);
    }

    // Create pipeline status for tracking
    const pipeline = options.pipeline ?? {
      update: (phase: string, progress?: number, message?: string) => {
        if (logger) {
          logger.debug({ phase, progress, message }, "Pipeline update");
        }
      },
    };

    // Create and run the No-Intro scraper
    const scraper = new NoIntroScraper({
      dataDir,
      logger: logger?.child({ system: "scraper" }),
    });

    // Register source in pipeline
    pipeline.update("register", 0, "No-Intro scraper initialized");

    if (logger) {
      logger.info("Starting No-Intro scrape");
    }

    // Run the scraper lifecycle
    const runResult = await scraper.run();

    if (!runResult.ok) {
      const error = runResult.error;
      if (logger) {
        logger.error({ error: error.message }, "Scrape failed");
      }
      await scraper.close();
      return err(error);
    }

    // Get records processed
    const recordsProcessed = runResult.value.entriesParsed ?? 0;

    if (logger) {
      logger.info(
        { recordsProcessed, phase: runResult.value.phase },
        "Scrape completed successfully"
      );
    }

    pipeline.update("complete", 100, `Processed ${recordsProcessed} records`);

    // Cleanup
    await scraper.close();

    return ok({
      success: true,
      recordsProcessed,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.error({ error: errMsg }, "Scrape command failed");
    }
    return err(new Error(errMsg));
  }
}
