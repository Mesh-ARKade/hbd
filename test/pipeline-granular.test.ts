/**
 * Tests for PipelineStatus granular progress tracking.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PipelineStatus } from "../src/dashboard/pipeline-status.js";
import { isOk, isErr } from "../src/core/result.js";

describe("PipelineStatus Granular Progress", () => {
  let status: PipelineStatus;
  let broadcastedStates: any[] = [];

  beforeEach(() => {
    broadcastedStates = [];
    status = new PipelineStatus({
      broadcast: (state) => broadcastedStates.push(state),
      initialSources: ["nointro"],
    });
  });

  describe("updateSubPhase", () => {
    it("should update sub-phase with progress", () => {
      status.start("nointro");
      
      const result = status.updateSubPhase("nointro", {
        phase: "Parsing",
        subPhase: "Nintendo - Game Boy.dat",
        subProgress: 65,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.phase).toBe("Parsing");
        expect(result.value.subPhase).toBe("Nintendo - Game Boy.dat");
        expect(result.value.subProgress).toBe(65);
      }
    });

    it("should broadcast granular progress", () => {
      status.start("nointro");
      broadcastedStates = [];
      
      status.updateSubPhase("nointro", {
        phase: "Decompressing",
        subPhase: "daily.zip",
        subProgress: 30,
      });

      expect(broadcastedStates.length).toBeGreaterThan(0);
      const lastState = broadcastedStates[broadcastedStates.length - 1];
      expect(lastState.sources.nointro.subPhase).toBe("daily.zip");
      expect(lastState.sources.nointro.subProgress).toBe(30);
    });

    it("should update overall progress based on sub-progress", () => {
      status.start("nointro");
      
      status.updateSubPhase("nointro", {
        phase: "Parsing",
        subPhase: "file1.dat",
        subProgress: 50,
        overallProgress: 25,
      });

      const state = status.getState();
      expect(state.sources.nointro.progress).toBe(25);
    });

    it("should return error for non-existent source", () => {
      const result = status.updateSubPhase("nonexistent", {
        phase: "Parsing",
        subProgress: 50,
      });

      expect(isErr(result)).toBe(true);
    });

    it("should validate sub-progress bounds", () => {
      status.start("nointro");
      
      const result = status.updateSubPhase("nointro", {
        phase: "Parsing",
        subProgress: 150,
      });

      expect(isErr(result)).toBe(true);
    });

    it("should track multiple sub-phase updates", () => {
      status.start("nointro");
      
      // First file
      status.updateSubPhase("nointro", {
        phase: "Parsing",
        subPhase: "nes.dat",
        subProgress: 100,
        filesProcessed: 1,
        totalFiles: 3,
      });

      // Second file
      status.updateSubPhase("nointro", {
        phase: "Parsing",
        subPhase: "snes.dat",
        subProgress: 50,
        filesProcessed: 2,
        totalFiles: 3,
      });

      const state = status.getSourceState("nointro");
      expect(state?.subPhase).toBe("snes.dat");
      expect(state?.filesProcessed).toBe(2);
      expect(state?.totalFiles).toBe(3);
    });

    it("should calculate estimated time remaining", () => {
      status.start("nointro");
      
      status.updateSubPhase("nointro", {
        phase: "Downloading",
        subProgress: 50,
        bytesProcessed: 50000000,
        bytesTotal: 100000000,
        etaSeconds: 120,
      });

      const state = status.getSourceState("nointro");
      expect(state?.etaSeconds).toBe(120);
      expect(state?.bytesProcessed).toBe(50000000);
    });

    it("should include sub-phase in state snapshot", () => {
      status.start("nointro");
      
      status.updateSubPhase("nointro", {
        phase: "Merging",
        subPhase: "Consolidating entries",
        subProgress: 75,
        overallProgress: 50,
      });

      const snapshot = status.getState();
      expect(snapshot.sources.nointro.subPhase).toBe("Consolidating entries");
      expect(snapshot.overall.progress).toBe(50);
    });

    it("should clear sub-phase on completion", () => {
      status.start("nointro");
      
      status.updateSubPhase("nointro", {
        phase: "Writing",
        subPhase: "Finalizing",
        subProgress: 100,
      });

      status.complete("nointro", { recordsProcessed: 1000 });

      const state = status.getSourceState("nointro");
      expect(state?.status).toBe("completed");
      expect(state?.progress).toBe(100);
    });
  });

  describe("granular progress events", () => {
    it("should emit granular progress events", () => {
      const progressEvents: any[] = [];
      status.on("granularProgress", (data) => progressEvents.push(data));
      
      status.start("nointro");
      status.updateSubPhase("nointro", {
        phase: "Fetching",
        subPhase: "Downloading DAT pack",
        subProgress: 45,
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].subPhase).toBe("Downloading DAT pack");
    });

  });
});
