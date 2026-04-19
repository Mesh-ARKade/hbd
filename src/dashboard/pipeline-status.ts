/**
 * PipelineStatus - Central state store for tracking metadata source progress.
 * Provides real-time state management with Result pattern and event broadcasting.
 * @packageDocumentation
 */

import { EventEmitter } from "node:events";
import { ok, err, Result } from "../core/result";

/** Status values for a metadata source */
export type SourceStatusValue = "pending" | "running" | "completed" | "error" | "cancelled";

/** Individual source state */
export interface SourceStatus {
  /** Source identifier */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Current status */
  status: SourceStatusValue;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current operation phase */
  phase?: string;
  /** Timestamp when started */
  startedAt?: number;
  /** Timestamp when completed */
  completedAt?: number;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Records processed (for completed sources) */
  recordsProcessed?: number;
}

/** Overall pipeline state */
export interface PipelineState {
  /** Map of source ID to status */
  sources: Record<string, SourceStatus>;
  /** Overall pipeline status */
  overall: {
    status: SourceStatusValue;
    progress: number;
    activeSources: number;
    completedSources: number;
    errorSources: number;
  };
  /** Last update timestamp */
  updatedAt: number;
}

/** Options for PipelineStatus constructor */
export interface PipelineStatusOptions {
  /** Broadcast function for state changes */
  broadcast?: (state: PipelineState) => void;
  /** Initial source IDs to register */
  initialSources?: string[];
}

/** Progress update payload */
export interface ProgressUpdate {
  progress?: number;
  phase?: string;
  status?: SourceStatusValue;
  metadata?: Record<string, unknown>;
}

/**
 * Central state store for tracking metadata source progress.
 * Emits events and broadcasts state changes for real-time dashboard updates.
 */
export class PipelineStatus extends EventEmitter {
  private sources: Map<string, SourceStatus> = new Map();
  private broadcast: ((state: PipelineState) => void) | null = null;
  private lastState: PipelineState | null = null;

  constructor(options: PipelineStatusOptions = {}) {
    super();
    this.broadcast = options.broadcast ?? null;

    // Register initial sources
    if (options.initialSources) {
      for (const id of options.initialSources) {
        this.registerSourceInternal(id, { name: id });
      }
    }
  }

  /**
   * Get current state of all sources.
   */
  getState(): PipelineState {
    const sources: Record<string, SourceStatus> = {};
    for (const [id, status] of this.sources) {
      sources[id] = { ...status };
    }

    return {
      sources,
      overall: this.calculateOverall(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Get state of a specific source.
   */
  getSourceState(id: string): SourceStatus | undefined {
    const source = this.sources.get(id);
    return source ? { ...source } : undefined;
  }

  /**
   * Register a new metadata source.
   */
  registerSource(
    id: string,
    info: { name: string; description?: string }
  ): Result<SourceStatus, Error> {
    if (this.sources.has(id)) {
      return err(new Error(`Source '${id}' is already registered`));
    }

    const source = this.registerSourceInternal(id, info);
    this.emitChange();
    return ok(source);
  }

  private registerSourceInternal(
    id: string,
    info: { name: string; description?: string }
  ): SourceStatus {
    const source: SourceStatus = {
      id,
      name: info.name,
      description: info.description,
      status: "pending",
      progress: 0,
    };

    this.sources.set(id, source);
    return source;
  }

  /**
   * Update progress for a source.
   */
  updateProgress(id: string, update: ProgressUpdate): Result<SourceStatus, Error> {
    const source = this.sources.get(id);
    if (!source) {
      return err(new Error(`Source '${id}' not found`));
    }

    // Validate progress bounds
    if (update.progress !== undefined) {
      if (update.progress < 0 || update.progress > 100) {
        return err(new Error("Progress must be between 0 and 100"));
      }
      source.progress = update.progress;
    }

    if (update.phase !== undefined) {
      source.phase = update.phase;
    }

    if (update.status !== undefined) {
      source.status = update.status;
    }

    if (update.metadata !== undefined) {
      source.metadata = { ...source.metadata, ...update.metadata };
    }

    this.emitChange();
    return ok({ ...source });
  }

  /**
   * Mark a source as started.
   */
  start(id: string): Result<SourceStatus, Error> {
    const source = this.sources.get(id);
    if (!source) {
      return err(new Error(`Source '${id}' not found`));
    }

    source.status = "running";
    source.startedAt = Date.now();
    source.progress = 0;
    source.error = undefined;

    this.emitChange();
    return ok({ ...source });
  }

  /**
   * Mark a source as completed.
   */
  complete(id: string, result: { recordsProcessed?: number }): Result<SourceStatus, Error> {
    const source = this.sources.get(id);
    if (!source) {
      return err(new Error(`Source '${id}' not found`));
    }

    if (source.status !== "running") {
      return err(new Error(`Cannot complete source '${id}' from status '${source.status}'`));
    }

    source.status = "completed";
    source.completedAt = Date.now();
    source.progress = 100;

    if (result.recordsProcessed !== undefined) {
      source.recordsProcessed = result.recordsProcessed;
    }

    this.emitChange();
    return ok({ ...source });
  }

  /**
   * Mark a source as failed.
   */
  fail(id: string, error: string): Result<SourceStatus, Error> {
    const source = this.sources.get(id);
    if (!source) {
      return err(new Error(`Source '${id}' not found`));
    }

    source.status = "error";
    source.error = error;
    source.completedAt = Date.now();

    this.emitChange();
    return ok({ ...source });
  }

  /**
   * Cancel a source.
   */
  cancel(id: string): Result<SourceStatus, Error> {
    const source = this.sources.get(id);
    if (!source) {
      return err(new Error(`Source '${id}' not found`));
    }

    source.status = "cancelled";
    source.completedAt = Date.now();

    this.emitChange();
    return ok({ ...source });
  }

  /**
   * Reset all sources to pending state.
   */
  reset(): Result<void, Error> {
    for (const source of this.sources.values()) {
      source.status = "pending";
      source.progress = 0;
      source.phase = undefined;
      source.startedAt = undefined;
      source.completedAt = undefined;
      source.error = undefined;
      source.metadata = undefined;
      source.recordsProcessed = undefined;
    }

    this.emitChange();
    return ok(undefined);
  }

  /**
   * Calculate overall pipeline status from individual sources.
   */
  private calculateOverall(): PipelineState["overall"] {
    const sources = Array.from(this.sources.values());

    if (sources.length === 0) {
      return {
        status: "idle",
        progress: 0,
        activeSources: 0,
        completedSources: 0,
        errorSources: 0,
      };
    }

    const totalProgress = sources.reduce((sum, s) => sum + s.progress, 0);
    const activeSources = sources.filter((s) => s.status === "running").length;
    const completedSources = sources.filter((s) => s.status === "completed").length;
    const errorSources = sources.filter((s) => s.status === "error").length;

    // Determine overall status
    let status: SourceStatusValue = "pending";
    if (errorSources > 0) {
      status = "error";
    } else if (activeSources > 0) {
      status = "running";
    } else if (completedSources === sources.length) {
      status = "completed";
    }

    return {
      status,
      progress: Math.round(totalProgress / sources.length),
      activeSources,
      completedSources,
      errorSources,
    };
  }

  /**
   * Emit state change event and broadcast.
   */
  private emitChange(): void {
    const state = this.getState();
    this.lastState = state;

    // Emit local event
    this.emit("change", state);

    // Broadcast to dashboard
    if (this.broadcast) {
      this.broadcast(state);
    }
  }
}
