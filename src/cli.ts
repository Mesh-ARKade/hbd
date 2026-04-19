#!/usr/bin/env node
/**
 * HBD CLI entry point.
 * Refactored with Result pattern and Pino logging.
 * @packageDocumentation
 */

import { Command } from "commander";
import { createMetadataStore } from "./storage/hyperbee.js";
import { createSyncPeer } from "./p2p/sync.js";
import { handleAdd, handleScan, handleList, handleInfo, handleSync, handleInit } from "./cli-handlers.js";
import { createLogger } from "./core/logger.js";
import { isOk, isErr } from "./core/result.js";
import * as fs from "node:fs";
import * as path from "node:path";

// Create CLI logger
const logger = createLogger({ 
  system: "cli", 
  level: process.env.HBD_LOG_LEVEL || "info" 
});

const program = new Command();

program
  .name("hbd")
  .description("HomeBase Directory - Decentralized ROM Catalog")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize a new HBD catalog")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .action(async (options) => {
    logger.info({ dir: options.dir }, "Init command invoked");
    
    const dataDir = path.resolve(options.dir);
    
    if (fs.existsSync(dataDir)) {
      logger.error({ dataDir }, "Directory already exists");
      console.error(`Directory already exists: ${dataDir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const result = await handleInit(store, logger);
    
    if (isOk(result)) {
      console.log(`Initialized HBD catalog at ${dataDir}`);
      console.log(`Public Key: ${result.value.publicKey}`);
      logger.info({ dataDir, publicKey: result.value.publicKey }, "Init completed");
    } else {
      logger.error({ error: result.error.message }, "Init failed");
      console.error(`Failed to initialize: ${result.error.message}`);
      process.exit(1);
    }
  });

program
  .command("add")
  .description("Add a ROM to the catalog")
  .requiredOption("-k, --key <sha1>", "SHA1 hash of the ROM")
  .requiredOption("-n, --name <name>", "ROM name")
  .requiredOption("-s, --system <system>", "System (e.g., NES, SNES)")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .option("--crc32 <crc32>", "CRC32 checksum")
  .option("--size <size>", "File size in bytes", parseInt)
  .action(async (options) => {
    logger.info({ key: options.key, name: options.name, system: options.system }, "Add command invoked");
    
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      logger.error({ dataDir }, "Directory not initialized");
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const romData = {
      name: options.name,
      system: options.system,
      ...(options.crc32 && { crc32: options.crc32 }),
      ...(options.size && { size: options.size }),
    };
    
    const result = await handleAdd(options.key, romData, store, logger);
    
    if (isOk(result)) {
      console.log(`Added: ${options.name} (${options.key})`);
      logger.info({ key: options.key, name: options.name }, "Add completed");
    } else {
      logger.error({ key: options.key, error: result.error.message }, "Add failed");
      console.error(`Failed to add ROM: ${result.error.message}`);
      process.exit(1);
    }
  });

program
  .command("scan")
  .description("Scan and list all ROMs in the catalog")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .action(async (options) => {
    logger.info({ dir: options.dir }, "Scan command invoked");
    
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      logger.error({ dataDir }, "Directory not initialized");
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const result = await handleScan(store, logger);
    
    if (isOk(result)) {
      const entries = result.value.filter(e => e.key.startsWith("sha1:"));
      console.log(`Found ${entries.length} entries:`);
      for (const { key, value } of entries) {
        const data = value as { name?: string; system?: string };
        console.log(`  ${key}: ${data.name || "Unknown"} (${data.system || "Unknown"})`);
      }
      logger.info({ count: entries.length }, "Scan completed");
    } else {
      logger.error({ error: result.error.message }, "Scan failed");
      console.error(`Failed to scan: ${result.error.message}`);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List ROMs by system")
  .argument("<system>", "System to filter by (e.g., NES, SNES)")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .action(async (system, options) => {
    logger.info({ system, dir: options.dir }, "List command invoked");
    
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      logger.error({ dataDir }, "Directory not initialized");
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const result = await handleList(system, store, logger);
    
    if (isOk(result)) {
      console.log(`Found ${result.value.length} ROMs for ${system}:`);
      for (const rom of result.value) {
        const data = rom as { name?: string };
        console.log(`  - ${data.name || "Unknown"}`);
      }
      logger.info({ system, count: result.value.length }, "List completed");
    } else {
      logger.error({ system, error: result.error.message }, "List failed");
      console.error(`Failed to list: ${result.error.message}`);
      process.exit(1);
    }
  });

program
  .command("info")
  .description("Get info for a specific ROM")
  .argument("<sha1>", "SHA1 hash of the ROM")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .action(async (sha1, options) => {
    logger.info({ sha1, dir: options.dir }, "Info command invoked");
    
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      logger.error({ dataDir }, "Directory not initialized");
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const key = sha1.startsWith("sha1:") ? sha1 : `sha1:${sha1}`;
    const result = await handleInfo(key, store, logger);
    
    if (isOk(result) && result.value !== null) {
      console.log(JSON.stringify(result.value, null, 2));
      logger.info({ key }, "Info completed");
    } else if (isErr(result)) {
      logger.error({ key, error: result.error.message }, "Info failed");
      console.error(`Failed to get info: ${result.error.message}`);
      process.exit(1);
    } else {
      console.error(`ROM not found: ${sha1}`);
      process.exit(1);
    }
  });

program
  .command("sync")
  .description("Sync catalog with P2P network")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .option("-t, --topic <topic>", "Discovery topic", "hbd-default")
  .action(async (options) => {
    logger.info({ dir: options.dir, topic: options.topic }, "Sync command invoked");
    
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      logger.error({ dataDir }, "Directory not initialized");
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    console.log("Starting P2P sync...");
    logger.info("P2P sync starting");
    
    const store = createMetadataStore(dataDir);
    const peer = createSyncPeer(dataDir, store);
    peer.setLogger(logger.child({ system: "p2p" }));
    
    const peerResult = await peer.open(options.topic);
    if (isErr(peerResult)) {
      logger.error({ error: peerResult.error.message }, "Peer open failed");
      console.error(`Failed to open peer: ${peerResult.error.message}`);
      process.exit(1);
    }
    
    const statusResult = await handleSync(store, logger);
    if (isOk(statusResult)) {
      console.log(`Public Key: ${statusResult.value.publicKey}`);
      console.log(`Connected Peers: ${peer.getPeerCount()}`);
    }
    
    // Keep running for a bit to allow discovery
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await peer.close();
    console.log("Sync complete.");
    logger.info({ peers: peer.getPeerCount() }, "Sync completed");
  });

program
  .command("dashboard")
  .description("Launch the HBD web dashboard")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .option("-p, --port <port>", "Port to run dashboard on", "3000")
  .option("--host <host>", "Host to bind to", "localhost")
  .action(async (options) => {
    logger.info({ dir: options.dir, port: options.port }, "Dashboard command invoked");

    const dataDir = path.resolve(options.dir);

    if (!fs.existsSync(dataDir)) {
      logger.error({ dataDir }, "Directory not initialized");
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }

    const { handleDashboard } = await import("./cli-handlers.js");
    const result = await handleDashboard(
      {
        dataDir,
        port: parseInt(options.port, 10),
        host: options.host,
      },
      logger
    );

    if (isOk(result)) {
      console.log("\n╔════════════════════════════════════════════════════════╗");
      console.log("║          🕹️  Mesh ARKade Dashboard Live                ║");
      console.log("╠════════════════════════════════════════════════════════╣");
      console.log(`║  URL:    ${result.value.url.padEnd(46)}║`);
      console.log(`║  Port:   ${result.value.port.toString().padEnd(46)}║`);
      console.log("║                                                        ║");
      console.log("║  Press Ctrl+C to stop the dashboard                    ║");
      console.log("╚════════════════════════════════════════════════════════╝\n");

      logger.info({ url: result.value.url, port: result.value.port }, "Dashboard started");

      // Keep process alive
      process.on("SIGINT", async () => {
        console.log("\nShutting down dashboard...");
        await result.value.close();
        process.exit(0);
      });

      // Keep running indefinitely
      await new Promise(() => {});
    } else {
      logger.error({ error: result.error.message }, "Dashboard failed to start");
      console.error(`Failed to start dashboard: ${result.error.message}`);
      process.exit(1);
    }
  });

program.parse();