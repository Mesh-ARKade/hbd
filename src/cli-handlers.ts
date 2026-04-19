/**
 * CLI command handlers for HBD commands.
 * Refactored to use Result pattern and Pino logging.
 * @packageDocumentation
 */

import { MetadataStore } from "./storage/hyperbee";
import { ok, err, Result } from "./core/result";
import { Logger } from "pino";
import * as fs from "node:fs";
import * as path from "node:path";

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
      logger.info("Add command started", { key });
    }
    
    const openResult = await store.open();
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
    
    const openResult = await store.open();
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
    
    const openResult = await store.open();
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
    
    const openResult = await store.open();
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
    
    const openResult = await store.open();
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
 * Initialize a new HBD store.
 */
export async function handleInit(
  store: MetadataStore,
  logger?: Logger
): Promise<Result<{ publicKey: string }, Error>> {
  try {
    if (logger) {
      logger.info("Init command started");
    }
    
    const result = await store.open();
    if (!result.ok) {
      if (logger) {
        logger.error({ error: result.error.message }, "Init failed");
      }
      return err(result.error);
    }

    if (logger) {
      logger.info({ publicKey: result.value }, "Init command completed");
    }
    return ok({ publicKey: result.value });
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