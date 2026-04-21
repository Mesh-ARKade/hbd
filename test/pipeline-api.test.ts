/**
 * Tests for Pipeline API endpoints.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import * as fs from "node:fs";
import type { DashboardServer } from "../src/dashboard/server.js";
import type { PipelineStatus } from "../src/dashboard/pipeline-status.js";

describe("Pipeline API Endpoints", () => {
  let testDir: string;
  let server: DashboardServer;
  let pipeline: PipelineStatus;
  const baseUrl = "http://localhost:3333";

  beforeEach(async () => {
    testDir = getUniqueTestDir(".hbd-pipeline-api-test");
    fs.mkdirSync(testDir, { recursive: true });

    // Dynamic import to avoid issues
    const { DashboardServer: DS } = await import("../src/dashboard/server.js");
    const { PipelineStatus: PS } = await import("../src/dashboard/pipeline-status.js");

    pipeline = new PS({
      broadcast: vi.fn(),
    });

    server = new DS({
      dataDir: testDir,
      port: 3333,
      pipeline,
    });

    await server.start();
  });

  afterEach(async () => {
    await server.close();
    await robustRm(testDir);
  });

  describe("POST /api/pipeline/start", () => {
    it("should start a specific source by ID", async () => {
      const response = await fetch(`${baseUrl}/api/pipeline/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "nointro" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should start all sources when sourceId is 'all'", async () => {
      const response = await fetch(`${baseUrl}/api/pipeline/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "all" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.started).toBeGreaterThan(0);
    });

    it("should return 400 if sourceId is missing", async () => {
      const response = await fetch(`${baseUrl}/api/pipeline/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/pipeline/config", () => {
    it("should update maxConcurrent limit", async () => {
      const response = await fetch(`${baseUrl}/api/pipeline/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxConcurrent: 2 }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.maxConcurrent).toBe(2);
    });

    it("should clamp maxConcurrent to 1-4 range", async () => {
      const response = await fetch(`${baseUrl}/api/pipeline/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxConcurrent: 10 }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.maxConcurrent).toBe(4);
    });

    it("should return 400 if maxConcurrent is missing", async () => {
      const response = await fetch(`${baseUrl}/api/pipeline/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/pipeline/queue", () => {
    it("should return queue status", async () => {
      const response = await fetch(`${baseUrl}/api/pipeline/queue`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.jobs).toBeDefined();
      expect(data.maxConcurrent).toBeDefined();
      expect(data.runningCount).toBeDefined();
      expect(data.pendingCount).toBeDefined();
    });
  });
});

describe("CLI-to-Dashboard Proxy", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-cli-proxy-test");
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("isDashboardRunning", () => {
    it("should detect active dashboard server", async () => {
      const { isDashboardRunning } = await import("../src/cli-proxy.js");

      // Start a test server
      const { DashboardServer } = await import("../src/dashboard/server.js");
      const server = new DashboardServer({
        dataDir: testDir,
        port: 3334,
      });
      await server.start();

      try {
        const isRunning = await isDashboardRunning(3334);
        expect(isRunning).toBe(true);
      } finally {
        await server.close();
      }
    });

    it("should return false when dashboard is not running", async () => {
      const { isDashboardRunning } = await import("../src/cli-proxy.js");

      const isRunning = await isDashboardRunning(9999);
      expect(isRunning).toBe(false);
    });
  });

  describe("sendScrapeRequest", () => {
    it("should send scrape request to dashboard API", async () => {
      const { sendScrapeRequest } = await import("../src/cli-proxy.js");

      // Start a test server
      const { DashboardServer } = await import("../src/dashboard/server.js");
      const { PipelineStatus } = await import("../src/dashboard/pipeline-status.js");

      const pipeline = new PipelineStatus({ broadcast: vi.fn() });
      const server = new DashboardServer({
        dataDir: testDir,
        port: 3335,
        pipeline,
      });
      await server.start();

      try {
        const result = await sendScrapeRequest("nointro", 3335);
        expect(result.ok).toBe(true);
      } finally {
        await server.close();
      }
    });

    it("should return error when server is unreachable", async () => {
      const { sendScrapeRequest } = await import("../src/cli-proxy.js");

      const result = await sendScrapeRequest("nointro", 9999);
      expect(result.ok).toBe(false);
    });
  });
});
