#!/usr/bin/env node
/**
 * HBD CLI entry point.
 * @packageDocumentation
 */

import { Command } from "commander";
import { createMetadataStore } from "./storage/hyperbee.js";
import { createSyncPeer } from "./p2p/sync.js";
import { handleAdd, handleScan, handleList, handleInfo, handleSync } from "./cli-handlers.js";
import * as fs from "node:fs";
import * as path from "node:path";

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
    const dataDir = path.resolve(options.dir);
    
    if (fs.existsSync(dataDir)) {
      console.error(`Directory already exists: ${dataDir}`);
      process.exit(1);
    }
    
    fs.mkdirSync(dataDir, { recursive: true });
    
    const store = createMetadataStore(dataDir);
    await store.open();
    const publicKey = store.getPublicKey();
    await store.close();
    
    console.log(`Initialized HBD catalog at ${dataDir}`);
    console.log(`Public Key: ${publicKey}`);
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
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
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
    
    const success = await handleAdd(options.key, romData, store);
    
    if (success) {
      console.log(`Added: ${options.name} (${options.key})`);
    } else {
      console.error("Failed to add ROM");
      process.exit(1);
    }
  });

program
  .command("scan")
  .description("Scan and list all ROMs in the catalog")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .action(async (options) => {
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const results = await handleScan(store);
    
    console.log(`Found ${results.length} entries:`);
    for (const { key, value } of results) {
      if (key.startsWith("sha1:")) {
        const data = value as { name?: string; system?: string };
        console.log(`  ${key}: ${data.name || "Unknown"} (${data.system || "Unknown"})`);
      }
    }
  });

program
  .command("list")
  .description("List ROMs by system")
  .argument("<system>", "System to filter by (e.g., NES, SNES)")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .action(async (system, options) => {
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const results = await handleList(system, store);
    
    console.log(`Found ${results.length} ROMs for ${system}:`);
    for (const rom of results) {
      const data = rom as { name?: string };
      console.log(`  - ${data.name || "Unknown"}`);
    }
  });

program
  .command("info")
  .description("Get info for a specific ROM")
  .argument("<sha1>", "SHA1 hash of the ROM")
  .option("-d, --dir <directory>", "Data directory", ".hbd-data")
  .action(async (sha1, options) => {
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const key = sha1.startsWith("sha1:") ? sha1 : `sha1:${sha1}`;
    const info = await handleInfo(key, store);
    
    if (info) {
      console.log(JSON.stringify(info, null, 2));
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
    const dataDir = path.resolve(options.dir);
    
    if (!fs.existsSync(dataDir)) {
      console.error(`HBD not initialized. Run: hbd init -d ${options.dir}`);
      process.exit(1);
    }
    
    const store = createMetadataStore(dataDir);
    const peer = createSyncPeer(dataDir, store);
    
    console.log("Starting P2P sync...");
    await peer.open(options.topic);
    
    const status = await handleSync(store);
    console.log(`Public Key: ${status.publicKey}`);
    console.log(`Connected Peers: ${peer.getPeerCount()}`);
    
    // Keep running for a bit to allow discovery
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await peer.close();
    console.log("Sync complete.");
  });

program.parse();
