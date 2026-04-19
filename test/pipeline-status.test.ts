/**
 * Tests for PipelineStatus - Central state store for dashboard.
 * Tracks progress, phase, and status of each metadata source.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PipelineStatus, PipelineState, SourceStatus } from "../src/dashboard/pipeline-status.js";
import { isOk, isErr } from "../src/core/result.js";

describe("PipelineStatus", () => {
  let status: PipelineStatus;
  let mockBroadcast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockBroadcast = vi.fn();
    status = new PipelineStatus({ broadcast: mockBroadcast });
  });

  describe("initialization", () => {
    it("should create with empty state", () => {
      const state = status.getState();
      expect(state.sources).toEqual({});
      expect(state.overall.status).toBe("idle");
    });

    it("should create with initial sources", () => {
      const withSources = new PipelineStatus({
        broadcast: mockBroadcast,
        initialSources: ["nointro", "redump"],
      });

      const state = withSources.getState();
      expect(state.sources["nointro"]).toBeDefined();
      expect(state.sources["redump"]).toBeDefined();
      expect(state.sources["nointro"].status).toBe("pending");
    });
  });

  describe("source registration", () => {
    it("should register a new source", () => {
      const result = status.registerSource("test-source", {
        name: "Test Source",
        description: "A test metadata source",
      });

      expect(isOk(result)).toBe(true);
      const state = status.getState();
      expect(state.sources["test-source"]).toBeDefined();
      expect(state.sources["test-source"].name).toBe("Test Source");
    });

    it("should return error for duplicate source registration", () => {
      status.registerSource("dup-source", { name: "Original" });
      const result = status.registerSource("dup-source", { name: "Duplicate" });

      expect(isErr(result)).toBe(true);
    });

    it("should broadcast state change on registration", () => {
      status.registerSource("broadcast-test", { name: "Broadcast" });
      expect(mockBroadcast).toHaveBeenCalled();
    });
  });

  describe("progress updates", () => {
    beforeEach(() => {
      status.registerSource("update-source", { name: "Update Test" });
    });

    it("should update source progress", () => {
      const result = status.updateProgress("update-source", {
        progress: 50,
        phase: "downloading",
        status: "running",
      });

      expect(isOk(result)).toBe(true);
      const source = status.getSourceState("update-source");
      expect(source?.progress).toBe(50);
      expect(source?.phase).toBe("downloading");
      expect(source?.status).toBe("running");
    });

    it("should return error for non-existent source", () => {
      const result = status.updateProgress("non-existent", { progress: 50 });
      expect(isErr(result)).toBe(true);
    });

    it("should validate progress bounds (0-100)", () => {
      const low = status.updateProgress("update-source", { progress: -5 });
      const high = status.updateProgress("update-source", { progress: 105 });

      expect(isErr(low)).toBe(true);
      expect(isErr(high)).toBe(true);
    });

    it("should broadcast on progress update", () => {
      mockBroadcast.mockClear();
      status.updateProgress("update-source", { progress: 75 });
      expect(mockBroadcast).toHaveBeenCalled();
    });
  });

  describe("status transitions", () => {
    beforeEach(() => {
      status.registerSource("trans-source", { name: "Transition Test" });
    });

    it("should transition from pending to running", () => {
      status.start("trans-source");
      const source = status.getSourceState("trans-source");
      expect(source?.status).toBe("running");
      expect(source?.startedAt).toBeDefined();
    });

    it("should transition to completed", () => {
      status.start("trans-source");
      status.complete("trans-source", { recordsProcessed: 100 });

      const source = status.getSourceState("trans-source");
      expect(source?.status).toBe("completed");
      expect(source?.completedAt).toBeDefined();
      expect(source?.recordsProcessed).toBe(100);
    });

    it("should transition to error", () => {
      status.start("trans-source");
      status.fail("trans-source", "Network timeout");

      const source = status.getSourceState("trans-source");
      expect(source?.status).toBe("error");
      expect(source?.error).toBe("Network timeout");
    });

    it("should not allow invalid transitions", () => {
      // Can't complete before starting
      const result = status.complete("trans-source", {});
      expect(isErr(result)).toBe(true);
    });
  });

  describe("overall status calculation", () => {
    it("should calculate overall progress as average", () => {
      status.registerSource("src1", { name: "Source 1" });
      status.registerSource("src2", { name: "Source 2" });

      status.updateProgress("src1", { progress: 100, status: "completed" });
      status.updateProgress("src2", { progress: 50, status: "running" });

      const state = status.getState();
      expect(state.overall.progress).toBe(75);
    });

    it("should determine overall status from sources", () => {
      status.registerSource("a", { name: "A" });
      status.registerSource("b", { name: "B" });

      // One error = overall error
      status.start("a");
      status.fail("a", "Error");
      status.start("b");

      let state = status.getState();
      expect(state.overall.status).toBe("error");

      // Reset and test running
      status = new PipelineStatus({ broadcast: mockBroadcast });
      status.registerSource("c", { name: "C" });
      status.registerSource("d", { name: "D" });
      status.start("c");

      state = status.getState();
      expect(state.overall.status).toBe("running");
    });
  });

  describe("state reset", () => {
    it("should reset all sources", () => {
      status.registerSource("reset-test", { name: "Reset" });
      status.start("reset-test");
      status.updateProgress("reset-test", { progress: 50 });

      const result = status.reset();
      expect(isOk(result)).toBe(true);

      const state = status.getState();
      expect(state.sources["reset-test"].progress).toBe(0);
      expect(state.sources["reset-test"].status).toBe("pending");
    });
  });

  describe("event emission", () => {
    it("should emit events on state changes", () => {
      const listener = vi.fn();
      status.on("change", listener);

      status.registerSource("event-test", { name: "Event" });
      expect(listener).toHaveBeenCalled();
    });
  });
});

describe("PipelineState types", () => {
  it("should have correct status values", () => {
    const statuses: SourceStatus["status"][] = [
      "pending",
      "running",
      "completed",
      "error",
      "cancelled",
    ];
    expect(statuses).toHaveLength(5);
  });
});
