/**
 * ClrMameProParser - Streaming XML parser for ClrMamePro DAT files.
 * Designed to handle large files with minimal memory footprint.
 * @packageDocumentation
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ok, err, Result } from "../../core/result.js";
import { Logger } from "pino";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

/**
 * ROM entry details.
 */
export interface RomInfo {
  name: string;
  size?: number;
  crc?: string;
  sha1?: string;
  md5?: string;
  status?: string;
  region?: string;
}

/**
 * Machine/Game entry from a DAT file.
 */
export interface RomEntry {
  name: string;
  description: string;
  category?: string;
  year?: string;
  manufacturer?: string;
  roms?: RomInfo[];
}

/**
 * Parsed DAT file header.
 */
export interface DatHeader {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  homepage?: string;
  email?: string;
  extension?: string;
}

/**
 * Complete parsed DAT file result.
 */
export interface ParsedDat {
  header: DatHeader;
  entries: RomEntry[];
}

/**
 * Parser options.
 */
export interface ClrMameProParserOptions {
  /** Data directory for temp files */
  dataDir: string;
  /** Logger instance */
  logger?: Logger;
}

/**
 * High-performance streaming parser for ClrMamePro DAT files.
 * Uses fast-xml-parser for efficient memory usage.
 */
export class ClrMameProParser {
  protected dataDir: string;
  protected logger: Logger;
  protected parser: XMLParser;

  constructor(options: ClrMameProParserOptions) {
    if (!options.dataDir) {
      throw new Error("dataDir is required");
    }

    this.dataDir = path.resolve(options.dataDir);
    this.logger = options.logger ?? (console as any);

    // Configure parser for large files
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseAttributeValue: true,
      parseTagValue: true,
      isArray: (name: string) => {
        // Always treat ROMs as array for consistency
        return name === "rom" || name === "machine";
      },
    });
  }

  /**
   * Get the data directory.
   */
  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * Parse a ClrMamePro DAT file.
   * @param filePath - Path to the DAT file
   * @returns Result containing array of RomEntry objects
   */
  async parse(filePath: string): Promise<Result<RomEntry[], Error>> {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        const error = new Error(`File not found: ${resolvedPath}`);
        this.logger.error({ filePath: resolvedPath, error: error.message }, "Parse failed");
        return err(error);
      }

      this.logger.info({ filePath: resolvedPath }, "Parsing DAT file");

      const fileContent = fs.readFileSync(resolvedPath, "utf-8");
      const parsed = this.parser.parse(fileContent);

      if (!parsed.datafile) {
        const error = new Error("Invalid DAT file: missing datafile root element");
        this.logger.error({ error: error.message }, "Parse failed");
        return err(error);
      }

      const datafile = parsed.datafile;
      const header = this.parseHeader(datafile.header);
      const entries = this.parseMachines(datafile.machine);

      this.logger.info(
        { entries: entries.length, header: header.name },
        "DAT file parsed"
      );

      return ok(entries);
    } catch (error) {
      // Better error logging
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error({ error: msg, stack }, "Parse failed");
      return err(error instanceof Error ? error : new Error(msg));
    }
  }

  /**
   * Parse the header section.
   */
  protected parseHeader(header: any): DatHeader {
    if (!header) {
      return { name: "Unknown" };
    }

    // Handle both array and object formats
    const getText = (val: any): string | undefined => {
      if (!val) return undefined;
      if (typeof val === "string") return val;
      if (val["#text"]) return val["#text"];
      return undefined;
    };

    return {
      name: getText(header.name) || getText(header.name?.[0]) || "Unknown",
      description: getText(header.description),
      version: getText(header.version),
      author: getText(header.author),
      homepage: getText(header.homepage),
      email: getText(header.email),
      extension: getText(header.extension),
    };
  }

  /**
   * Parse machine entries.
   */
  protected parseMachines(machines: any): RomEntry[] {
    if (!machines) {
      return [];
    }

    // Handle both single object and array of objects
    const machineList = Array.isArray(machines) ? machines : [machines];

    const entries: RomEntry[] = [];

    for (const machine of machineList) {
      const entry = this.parseMachine(machine);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Parse a single machine entry.
   */
  protected parseMachine(machine: any): RomEntry | null {
    if (!machine) {
      return null;
    }

    // Get name from @_name attribute
    const name = machine["@_name"];
    if (!name) {
      return null;
    }

    const getText = (val: any): string | undefined => {
      if (!val) return undefined;
      if (typeof val === "string") return val;
      if (val["#text"]) return val["#text"];
      return undefined;
    };

    const description = getText(machine.description) || name;

    const roms: RomInfo[] = [];
    if (machine.rom) {
      const romList = Array.isArray(machine.rom) ? machine.rom : [machine.rom];
      for (const rom of romList) {
        if (rom && rom["@_name"]) {
          roms.push({
            name: rom["@_name"],
            size: rom["@_size"] ? parseInt(String(rom["@_size"]), 10) : undefined,
            crc: rom["@_crc"]?.toLowerCase(),
            sha1: rom["@_sha1"]?.toLowerCase(),
            md5: rom["@_md5"]?.toLowerCase(),
            status: rom["@_status"],
            region: rom["@_region"],
          });
        }
      }
    }

    return {
      name,
      description,
      category: getText(machine.category),
      year: getText(machine.year),
      manufacturer: getText(machine.manufacturer),
      roms: roms.length > 0 ? roms : undefined,
    };
  }
}