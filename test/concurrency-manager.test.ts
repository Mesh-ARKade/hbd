/**
 * Tests for ConcurrencyManager - Worker Queue with concurrency limits.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConcurrencyManager, QueuedJob, JobStatus } from "../src/dashboard/concurrency-manager.js";

describe("ConcurrencyManager", () => {
  let manager: ConcurrencyManager;

  beforeEach(() => {
    manager = new ConcurrencyManager({
      maxConcurrent: 2,
    });
  });

  describe("constructor", () => {
    it("should initialize with maxConcurrent limit", () => {
      expect(manager.getMaxConcurrent()).toBe(2);
    });

    it("should default to maxConcurrent of 1", () => {
      const defaultManager = new ConcurrencyManager({});
      expect(defaultManager.getMaxConcurrent()).toBe(1);
    });

    it("should clamp maxConcurrent to range 1-4", () => {
      const manager5 = new ConcurrencyManager({ maxConcurrent: 5 });
      expect(manager5.getMaxConcurrent()).toBe(4);

      const manager0 = new ConcurrencyManager({ maxConcurrent: 0 });
      expect(manager0.getMaxConcurrent()).toBe(1);
    });
  });

  describe("enqueue job", () => {
    it("should add job to queue", () => {
      const job = manager.enqueue({
        id: "nointro-nes",
        name: "No-Intro NES",
        sourceType: "nointro",
      });

      expect(job).toBeDefined();
      // Job starts immediately since there's capacity (max=2)
      expect(job.status).toBe(JobStatus.Running);
    });

    it("should start job immediately if under limit", async () => {
      const job = manager.enqueue({
        id: "nointro-nes",
        name: "No-Intro NES",
        sourceType: "nointro",
      });

      // Should start immediately since we're under the limit
      expect(job.status).toBe(JobStatus.Running);
    });

    it("should keep job pending if at limit", async () => {
      // Enqueue 2 jobs (max is 2)
      const job1 = manager.enqueue({
        id: "nointro-nes",
        name: "No-Intro NES",
        sourceType: "nointro",
      });
      const job2 = manager.enqueue({
        id: "nointro-snes",
        name: "No-Intro SNES",
        sourceType: "nointro",
      });

      expect(job1.status).toBe(JobStatus.Running);
      expect(job2.status).toBe(JobStatus.Running);

      // Enqueue a 3rd job - should be pending
      const job3 = manager.enqueue({
        id: "nointro-gb",
        name: "No-Intro GB",
        sourceType: "nointro",
      });

      expect(job3.status).toBe(JobStatus.Pending);
    });
  });

  describe("job completion and auto-start", () => {
    it("should auto-start next pending job when one completes", async () => {
      // Enqueue 3 jobs (max 2)
      const job1 = manager.enqueue({
        id: "nointro-nes",
        name: "No-Intro NES",
        sourceType: "nointro",
      });
      const job2 = manager.enqueue({
        id: "nointro-snes",
        name: "No-Intro SNES",
        sourceType: "nointro",
      });
      const job3 = manager.enqueue({
        id: "nointro-gb",
        name: "No-Intro GB",
        sourceType: "nointro",
      });

      expect(job1.status).toBe(JobStatus.Running);
      expect(job2.status).toBe(JobStatus.Running);
      expect(job3.status).toBe(JobStatus.Pending);

      // Complete job1
      await manager.complete(job1.id);

      // job3 should now start
      const updatedJob3 = manager.getJob(job3.id);
      expect(updatedJob3?.status).toBe(JobStatus.Running);
    });

    it("should handle job failure and auto-start next", async () => {
      const job1 = manager.enqueue({
        id: "nointro-nes",
        name: "No-Intro NES",
        sourceType: "nointro",
      });
      const job2 = manager.enqueue({
        id: "nointro-snes",
        name: "No-Intro SNES",
        sourceType: "nointro",
      });
      const job3 = manager.enqueue({
        id: "nointro-gb",
        name: "No-Intro GB",
        sourceType: "nointro",
      });

      // Fail job1
      await manager.fail(job1.id, new Error("Network error"));

      // job3 should now start
      const updatedJob3 = manager.getJob(job3.id);
      expect(updatedJob3?.status).toBe(JobStatus.Running);
    });

    it("should continue auto-starting even after multiple failures", async () => {
      const job1 = manager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" });
      const job2 = manager.enqueue({ id: "j2", name: "Job 2", sourceType: "test" });
      const job3 = manager.enqueue({ id: "j3", name: "Job 3", sourceType: "test" });
      const job4 = manager.enqueue({ id: "j4", name: "Job 4", sourceType: "test" });

      // Fail both running jobs
      await manager.fail(job1.id, new Error("Error 1"));
      await manager.fail(job2.id, new Error("Error 2"));

      // job3 and job4 should both be running now
      expect(manager.getJob(job3.id)?.status).toBe(JobStatus.Running);
      expect(manager.getJob(job4.id)?.status).toBe(JobStatus.Running);
    });
  });

  describe("runAll behavior", () => {
    it("should enqueue all sources when runAll is called", () => {
      const sources = [
        { id: "nointro-nes", name: "NES", sourceType: "nointro" },
        { id: "nointro-snes", name: "SNES", sourceType: "nointro" },
        { id: "redump", name: "Redump", sourceType: "redump" },
      ];

      manager.runAll(sources);

      const jobs = manager.getAllJobs();
      expect(jobs.length).toBe(3);
    });

    it("should respect maxParallel limit with runAll", () => {
      manager = new ConcurrencyManager({ maxConcurrent: 1 });

      const sources = [
        { id: "nointro-nes", name: "NES", sourceType: "nointro" },
        { id: "nointro-snes", name: "SNES", sourceType: "nointro" },
        { id: "redump", name: "Redump", sourceType: "redump" },
      ];

      manager.runAll(sources);

      const runningJobs = manager.getRunningJobs();
      const pendingJobs = manager.getPendingJobs();

      expect(runningJobs.length).toBe(1);
      expect(pendingJobs.length).toBe(2);
    });
  });

  describe("status updates", () => {
    it("should track running job count", () => {
      manager = new ConcurrencyManager({ maxConcurrent: 2 });

      manager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" });
      manager.enqueue({ id: "j2", name: "Job 2", sourceType: "test" });
      manager.enqueue({ id: "j3", name: "Job 3", sourceType: "test" });

      expect(manager.getRunningCount()).toBe(2);
      expect(manager.getPendingCount()).toBe(1);
    });

    it("should return correct overall progress", () => {
      manager = new ConcurrencyManager({ maxConcurrent: 1 });

      manager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" });
      manager.enqueue({ id: "j2", name: "Job 2", sourceType: "test" });
      manager.enqueue({ id: "j3", name: "Job 3", sourceType: "test" });

      const progress = manager.getOverallProgress();

      expect(progress.total).toBe(3);
      expect(progress.running).toBe(1);
      expect(progress.pending).toBe(2);
      expect(progress.completed).toBe(0);
    });
  });

  describe("event callbacks", () => {
    it("should call onJobStart when job starts", async () => {
      const onJobStart = vi.fn();

      manager = new ConcurrencyManager({
        maxConcurrent: 1,
        onJobStart,
      });

      manager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" });

      expect(onJobStart).toHaveBeenCalledTimes(1);
    });

    it("should call onJobComplete when job completes", async () => {
      const onJobComplete = vi.fn();

      manager = new ConcurrencyManager({
        maxConcurrent: 1,
        onJobComplete,
      });

      const job = manager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" });
      await manager.complete(job.id);

      expect(onJobComplete).toHaveBeenCalledTimes(1);
    });

    it("should call onJobFail when job fails", async () => {
      const onJobFail = vi.fn();

      manager = new ConcurrencyManager({
        maxConcurrent: 1,
        onJobFail,
      });

      const job = manager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" });
      await manager.fail(job.id, new Error("Test error"));

      expect(onJobFail).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancel operations", () => {
    it("should cancel pending job when at limit", () => {
      // Create manager with limit 1 to force queuing
      const queuedManager = new ConcurrencyManager({ maxConcurrent: 1 });
      queuedManager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" }); // runs immediately
      
      const job2 = queuedManager.enqueue({ id: "j2", name: "Job 2", sourceType: "test" }); // queued
      const result = queuedManager.cancel(job2.id);

      expect(result).toBe(true);
      expect(queuedManager.getJob(job2.id)?.status).toBe(JobStatus.Cancelled);
    });

    it("should cancel all pending jobs", () => {
      const queuedManager = new ConcurrencyManager({ maxConcurrent: 1 });
      queuedManager.enqueue({ id: "j1", name: "Job 1", sourceType: "test" });
      queuedManager.enqueue({ id: "j2", name: "Job 2", sourceType: "test" });
      queuedManager.enqueue({ id: "j3", name: "Job 3", sourceType: "test" });
      queuedManager.cancelAll();

      // After cancelAll, no pending jobs (all cancelled)
      const pending = queuedManager.getPendingJobs();
      expect(pending.length).toBe(0);
    });
  });
});
