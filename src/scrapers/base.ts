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
   */
  abstract fetch(): Promise<void>;

  /**
   * Abstract method - download raw data.
   * Must be implemented by subclasses.
   */
  abstract download(): Promise<void>;

  /**
   * Decompress downloaded archive.
   * Default implementation does nothing. Override in subclasses.
   */
  async decompress(_zipPath?: string): Promise<Result<unknown, Error> | void> {
    // Default: no-op. Override in subclasses that need decompression.
  }

  /**
   * Abstract method - parse decompressed data.
   * Must be implemented by subclasses.
   */
  abstract parse(): Promise<void>;

  /**
   * Merge parsed data with existing catalog.
   * Can be overridden by subclasses.
   */
  async merge(): Promise<void> {
    this.setPhase(ScraperPhase.Merge);
    this.logger.info({ scraper: this.name }, "Merge phase (default: no-op)");
  }

  /**
   * Write merged data to storage.
   * Can be overridden by subclasses.
   */
  async write(): Promise<void> {
    this.setPhase(ScraperPhase.Write);
    this.logger.info({ scraper: this.name }, "Write phase (default: no-op)");
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
   * Orchestrates all phases in order.
   */
  async run(): Promise<Result<ScraperResult, Error>> {
    this.cancelled = false;
    this._entriesParsed = 0;
    this._entriesWritten = 0;

    try {
      // Phase 1: Fetch
      this.checkCancelled();
      this.setPhase(ScraperPhase.Fetch);
      await this.fetch();
      this.checkCancelled();

      // Phase 2: Download
      this.setPhase(ScraperPhase.Download);
      await this.download();
      this.checkCancelled();

      // Phase 3: Decompress
      this.setPhase(ScraperPhase.Decompress);
      await this.decompress();
      this.checkCancelled();

      // Phase 4: Parse
      this.setPhase(ScraperPhase.Parse);
      await this.parse();
      this.checkCancelled();

      // Phase 5: Merge
      this.setPhase(ScraperPhase.Merge);
      await this.merge();
      this.checkCancelled();

      // Phase 6: Write
      this.setPhase(ScraperPhase.Write);
      await this.write();

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.cancelled) {
        this.setPhase(ScraperPhase.Cancelled);
        return err(new Error("Scraper cancelled"));
      }

      this.setPhase(ScraperPhase.Error);
      this.logger.error(
        { scraper: this.name, error: errorMessage, phase: this.currentPhase },
        "Scraper run failed"
      );

      return err(error instanceof Error ? error : new Error(errorMessage));
    }
  }
}