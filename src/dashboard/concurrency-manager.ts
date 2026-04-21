/**
 * ConcurrencyManager - Worker Queue with concurrency limits.
 * Manages parallel execution of scraper jobs with configurable max concurrent limit.
 * @packageDocumentation
 */

import { Logger } from "pino";

/**
 * Job status enumeration.
 */
export enum JobStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

/**
 * Queued job definition.
 */
export interface QueuedJob {
  id: string;
  name: string;
  sourceType: string;
  status: JobStatus;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
}

/**
 * Job definition for enqueue.
 */
export interface JobDefinition {
  id: string;
  name: string;
  sourceType: string;
}

/**
 * Overall progress across all jobs.
 */
export interface OverallProgress {
  total: number;
  running: number;
  pending: number;
  completed: number;
  failed: number;
  cancelled: number;
}

/**
 * Options for ConcurrencyManager.
 */
export interface ConcurrencyManagerOptions {
  /** Maximum concurrent jobs (default: 1, clamped to 1-4) */
  maxConcurrent?: number;
  /** Logger instance */
  logger?: Logger;
  /** Callback when a job starts */
  onJobStart?: (job: QueuedJob) => void;
  /** Callback when a job completes */
  onJobComplete?: (job: QueuedJob) => void;
  /** Callback when a job fails */
  onJobFail?: (job: QueuedJob, error: Error) => void;
}

/**
 * ConcurrencyManager - Manages a worker queue with concurrency limits.
 * Ensures no more than maxConcurrent jobs run simultaneously.
 */
export class ConcurrencyManager {
  private maxConcurrent: number;
  private logger?: Logger;
  private jobs: Map<string, QueuedJob> = new Map();
  private jobQueue: string[] = []; // IDs in order
  private runningCount: number = 0;

  // Event callbacks
  private onJobStart?: (job: QueuedJob) => void;
  private onJobComplete?: (job: QueuedJob) => void;
  private onJobFail?: (job: QueuedJob, error: Error) => void;

  constructor(options: ConcurrencyManagerOptions = {}) {
    // Clamp maxConcurrent to 1-4
    const max = options.maxConcurrent ?? 1;
    this.maxConcurrent = Math.max(1, Math.min(4, max));

    this.logger = options.logger;
    this.onJobStart = options.onJobStart;
    this.onJobComplete = options.onJobComplete;
    this.onJobFail = options.onJobFail;

    if (this.logger) {
      this.logger.info(
        { maxConcurrent: this.maxConcurrent },
        "ConcurrencyManager initialized"
      );
    }
  }

  /**
   * Get the current max concurrent limit.
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Set a new max concurrent limit.
   */
  setMaxConcurrent(max: number): void {
    const newMax = Math.max(1, Math.min(4, max));

    if (newMax !== this.maxConcurrent) {
      this.maxConcurrent = newMax;

      if (this.logger) {
        this.logger.info({ maxConcurrent: this.maxConcurrent }, "Max concurrent updated");
      }

      // Trigger pending jobs to start if we have capacity
      this.processQueue();
    }
  }

  /**
   * Enqueue a job.
   */
  enqueue(def: JobDefinition): QueuedJob {
    const job: QueuedJob = {
      id: def.id,
      name: def.name,
      sourceType: def.sourceType,
      status: JobStatus.Pending,
    };

    this.jobs.set(job.id, job);
    this.jobQueue.push(job.id);

    // Try to start if we have capacity
    this.processQueue();

    if (this.logger) {
      this.logger.debug(
        { jobId: job.id, pending: this.getPendingCount() },
        "Job enqueued"
      );
    }

    return job;
  }

  /**
   * Run all sources at once.
   */
  runAll(sources: JobDefinition[]): QueuedJob[] {
    const jobs: QueuedJob[] = [];

    for (const source of sources) {
      const job = this.enqueue(source);
      jobs.push(job);
    }

    if (this.logger) {
      this.logger.info(
        { count: sources.length, maxConcurrent: this.maxConcurrent },
        "RunAll enqueued"
      );
    }

    return jobs;
  }

  /**
   * Process the queue and start pending jobs if we have capacity.
   */
  private processQueue(): void {
    while (this.runningCount < this.maxConcurrent && this.jobQueue.length > 0) {
      const nextId = this.jobQueue.find(
        (id) => this.jobs.get(id)?.status === JobStatus.Pending
      );

      if (!nextId) break;

      const job = this.jobs.get(nextId);
      if (!job) break;

      // Start the job
      job.status = JobStatus.Running;
      job.startedAt = Date.now();
      this.runningCount++;

      if (this.logger) {
        this.logger.info(
          { jobId: job.id, running: this.runningCount },
          "Job started"
        );
      }

      // Call the onJobStart callback
      this.onJobStart?.(job);
    }
  }

  /**
   * Mark a job as completed and trigger auto-start of next pending.
   */
  async complete(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (job.status !== JobStatus.Running) return;

    job.status = JobStatus.Completed;
    job.completedAt = Date.now();
    this.runningCount--;

    if (this.logger) {
      this.logger.info({ jobId: job.id }, "Job completed");
    }

    // Call the callback
    this.onJobComplete?.(job);

    // Trigger next pending job
    this.processQueue();
  }

  /**
   * Mark a job as failed and trigger auto-start of next pending.
   */
  async fail(jobId: string, error: Error): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (job.status !== JobStatus.Running) return;

    job.status = JobStatus.Failed;
    job.completedAt = Date.now();
    job.error = error;
    this.runningCount--;

    if (this.logger) {
      this.logger.error(
        { jobId: job.id, error: error.message },
        "Job failed"
      );
    }

    // Call the callback
    this.onJobFail?.(job, error);

    // Trigger next pending job
    this.processQueue();
  }

  /**
   * Cancel a specific job.
   */
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === JobStatus.Pending) {
      job.status = JobStatus.Cancelled;
      this.jobQueue = this.jobQueue.filter((id) => id !== jobId);

      if (this.logger) {
        this.logger.info({ jobId: job.id }, "Job cancelled");
      }

      return true;
    }

    return false;
  }

  /**
   * Cancel all jobs.
   */
  cancelAll(): void {
    for (const job of this.jobs.values()) {
      if (job.status === JobStatus.Pending) {
        job.status = JobStatus.Cancelled;
      }
    }
    this.jobQueue = [];

    if (this.logger) {
      this.logger.info("All jobs cancelled");
    }
  }

  /**
   * Get a specific job.
   */
  getJob(jobId: string): QueuedJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs.
   */
  getAllJobs(): QueuedJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get running jobs.
   */
  getRunningJobs(): QueuedJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.status === JobStatus.Running);
  }

  /**
   * Get pending jobs.
   */
  getPendingJobs(): QueuedJob[] {
    return Array.from(this.jobs.values()).filter(
      (j) => j.status === JobStatus.Pending
    );
  }

  /**
   * Get running job count.
   */
  getRunningCount(): number {
    return this.runningCount;
  }

  /**
   * Get pending job count.
   */
  getPendingCount(): number {
    return this.jobQueue.filter(
      (id) => this.jobs.get(id)?.status === JobStatus.Pending
    ).length;
  }

  /**
   * Get overall progress across all jobs.
   */
  getOverallProgress(): OverallProgress {
    const jobs = this.getAllJobs();

    return {
      total: jobs.length,
      running: jobs.filter((j) => j.status === JobStatus.Running).length,
      pending: jobs.filter((j) => j.status === JobStatus.Pending).length,
      completed: jobs.filter((j) => j.status === JobStatus.Completed).length,
      failed: jobs.filter((j) => j.status === JobStatus.Failed).length,
      cancelled: jobs.filter((j) => j.status === JobStatus.Cancelled).length,
    };
  }

  /**
   * Clear all jobs.
   */
  clear(): void {
    this.jobs.clear();
    this.jobQueue = [];
    this.runningCount = 0;
  }
}