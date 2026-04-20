/**
 * AbstractScraper - Base class for all metadata scrapers.
 * Defines the standard lifecycle orchestration: Fetch -> Download -> Decompress -> Parse -> Merge -> Write.
 * @packageDocumentation
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ok, err, Result } from "../core/result.js";
import { Logger } from "pino";

/**
 * Scraper lifecycle phases.
 */
export enum ScraperPhase {
  Idle = "idle",
  Fetch = "fetch",
  Download = "download",
  Decompress = "decompress",
  Parse = "parse",
  Merge = "merge",
  Write = "write",
  Complete = "complete",
  Error = "error",
  Cancelled = "cancelled",
}

/**
 * Options for initializing a scraper.
 */
export interface ScraperOptions {
  /** Data directory for storing scraped data */
  dataDir: string;
  /** Logger instance */
  logger?: Logger;
  /** Pipeline status updater */
  pipeline?: {
    update: (phase: string, progress?: number, message?: string) => void;
  };
  /** Optional name for this scraper */
  name?: string;
}

/**
 * Result of a scraper run.
 */
export interface ScraperResult {
  phase: ScraperPhase;
  entriesParsed?: number;
  entriesWritten?: number;
  outputPath?: string;
}

/**
 * Abstract base class for all scrapers.
 * Implements the standard lifecycle orchestration pattern.
 */
export abstract class AbstractScraper {
  protected dataDir: string;
  protected logger: Logger;
  protected pipeline?: ScraperOptions["pipeline"];
  protected name: string;
  protected currentPhase: ScraperPhase = ScraperPhase.Idle;
  protected cancelled: boolean = false;
  protected _entriesParsed: number = 0;
  protected _entriesWritten: number = 0;

  constructor(options: ScraperOptions) {
    if (!options.dataDir) {
      throw new Error("dataDir is required");
    }

    this.dataDir = path.resolve(options.dataDir);
    this.logger = options.logger ?? (console as any);
    this.pipeline = options.pipeline;
    this.name = options.name ?? this.constructor.name;

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Get the current scraper phase.
   */
  getPhase(): ScraperPhase {
    return this.currentPhase;
  }

  /**
   * Get the data directory.
   */
  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * Get the scraper name.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Set the current phase and notify the pipeline.
   */
  protected setPhase(phase: ScraperPhase): void {
    this.currentPhase = phase;
    this.logger.info({ phase, scraper: this.name }, "Phase transition");

    if (this.pipeline) {
      this.pipeline.update(phase, undefined, `${this.name}: ${phase}`);
    }
  }

  /**
   * Request cancellation of the scraper.
   */
  cancel(): void {
    this.cancelled = true;
    this.logger.info({ scraper: this.name }, "Cancellation requested");
  }

  /**
   * Check if cancelled.
   */
  protected isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Check and throw if cancelled.
   */
  protected checkCancelled(): void {
    if (this.cancelled) {
      this.setPhase(ScraperPhase.Cancelled);
      throw new Error("Scraper cancelled");
    }
  }

  /**
   * Abstract method - fetch metadata source.
   * Must be implemented by subclasses.
   * @returns Result<void, Error> - ok() on success, err() on failure
   */
  abstract fetch(): Promise<Result<void, Error>>;

  /**
   * Abstract method - download raw data.
   * Must be implemented by subclasses.
   * @returns Result<void, Error> - ok() on success, err() on failure
   */
  abstract download(): Promise<Result<void, Error>>;

  /**
   * Decompress downloaded archive.
   * Default implementation does nothing. Override in subclasses.
   * @returns Result<void, Error> - ok() on success, err() on failure
   */
  async decompress(): Promise<Result<void, Error>> {
    // Default: no-op. Override in subclasses that need decompression.
    return ok(void 0);
  }

  /**
   * Abstract method - parse decompressed data.
   * Must be implemented by subclasses.
   * @returns Result<void, Error> - ok() on success, err() on failure
   */
  abstract parse(): Promise<Result<void, Error>>;

  /**
   * Merge parsed data with existing catalog.
   * Can be overridden by subclasses.
   * @returns Result<void, Error> - ok() on success, err() on failure
   */
  async merge(): Promise<Result<void, Error>> {
    this.setPhase(ScraperPhase.Merge);
    this.logger.info({ scraper: this.name }, "Merge phase (default: no-op)");
    return ok(void 0);
  }

  /**
   * Write merged data to storage.
   * Can be overridden by subclasses.
   * @returns Result<void, Error> - ok() on success, err() on failure
   */
  async write(): Promise<Result<void, Error>> {
    this.setPhase(ScraperPhase.Write);
    this.logger.info({ scraper: this.name }, "Write phase (default: no-op)");
    return ok(void 0);
  }

  /**
   * Get count of entries parsed.
   */
  getEntriesParsed(): number {
    return this._entriesParsed;
  }

  /**
   * Get count of entries written.
   */
  getEntriesWritten(): number {
    return this._entriesWritten;
  }

  /**
   * Run the complete scraper lifecycle.
   * Orchestrates all phases in order with Result pattern.
   * If any phase returns an error, the pipeline stops and returns that error.
   */
  async run(): Promise<Result<ScraperResult, Error>> {
    this.cancelled = false;
    this._entriesParsed = 0;
    this._entriesWritten = 0;

    // Phase 1: Fetch
    if (this.cancelled) {
      this.setPhase(ScraperPhase.Cancelled);
      return err(new Error("Scraper cancelled"));
    }
    this.setPhase(ScraperPhase.Fetch);
    const fetchResult = await this.fetch();
    if (!fetchResult.ok) {
      this.setPhase(ScraperPhase.Error);
      this.logger.error(
        { scraper: this.name, error: fetchResult.error.message, phase: "fetch" },
        "Fetch phase failed"
      );
      return err(fetchResult.error);
    }

    // Phase 2: Download
    if (this.cancelled) {
      this.setPhase(ScraperPhase.Cancelled);
      return err(new Error("Scraper cancelled"));
    }
    this.setPhase(ScraperPhase.Download);
    const downloadResult = await this.download();
    if (!downloadResult.ok) {
      this.setPhase(ScraperPhase.Error);
      this.logger.error(
        { scraper: this.name, error: downloadResult.error.message, phase: "download" },
        "Download phase failed"
      );
      return err(downloadResult.error);
    }

    // Phase 3: Decompress
    if (this.cancelled) {
      this.setPhase(ScraperPhase.Cancelled);
      return err(new Error("Scraper cancelled"));
    }
    this.setPhase(ScraperPhase.Decompress);
    const decompressResult = await this.decompress();
    if (!decompressResult.ok) {
      this.setPhase(ScraperPhase.Error);
      this.logger.error(
        { scraper: this.name, error: decompressResult.error.message, phase: "decompress" },
        "Decompress phase failed"
      );
      return err(decompressResult.error);
    }

    // Phase 4: Parse
    if (this.cancelled) {
      this.setPhase(ScraperPhase.Cancelled);
      return err(new Error("Scraper cancelled"));
    }
    this.setPhase(ScraperPhase.Parse);
    const parseResult = await this.parse();
    if (!parseResult.ok) {
      this.setPhase(ScraperPhase.Error);
      this.logger.error(
        { scraper: this.name, error: parseResult.error.message, phase: "parse" },
        "Parse phase failed"
      );
      return err(parseResult.error);
    }

    // Phase 5: Merge
    if (this.cancelled) {
      this.setPhase(ScraperPhase.Cancelled);
      return err(new Error("Scraper cancelled"));
    }
    this.setPhase(ScraperPhase.Merge);
    const mergeResult = await this.merge();
    if (!mergeResult.ok) {
      this.setPhase(ScraperPhase.Error);
      this.logger.error(
        { scraper: this.name, error: mergeResult.error.message, phase: "merge" },
        "Merge phase failed"
      );
      return err(mergeResult.error);
    }

    // Phase 6: Write
    if (this.cancelled) {
      this.setPhase(ScraperPhase.Cancelled);
      return err(new Error("Scraper cancelled"));
    }
    this.setPhase(ScraperPhase.Write);
    const writeResult = await this.write();
    if (!writeResult.ok) {
      this.setPhase(ScraperPhase.Error);
      this.logger.error(
        { scraper: this.name, error: writeResult.error.message, phase: "write" },
        "Write phase failed"
      );
      return err(writeResult.error);
    }

    // Complete
    this.setPhase(ScraperPhase.Complete);
    this.logger.info(
      {
        scraper: this.name,
        entriesParsed: this._entriesParsed,
        entriesWritten: this._entriesWritten,
      },
      "Scraper run complete"
    );

    return ok({
      phase: ScraperPhase.Complete,
      entriesParsed: this._entriesParsed,
      entriesWritten: this._entriesWritten,
    });
  }
}