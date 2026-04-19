/**
 * Tests for DashboardServer - Fastify server with static file serving.
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { DashboardServer } from "../src/dashboard/server.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("DashboardServer", () => {
  let server: DashboardServer;
  let testDir: string;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-dashboard-test");
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    await robustRm(testDir);
  });

  describe("initialization", () => {
    it("should create a server instance with default options", () => {
      server = new DashboardServer({ dataDir: testDir });
      expect(server).toBeDefined();
      expect(server.getPort()).toBe(3000);
    });

    it("should create a server with custom port", () => {
      server = new DashboardServer({ dataDir: testDir, port: 8080 });
      expect(server.getPort()).toBe(8080);
    });

    it("should create a server with custom host", () => {
      server = new DashboardServer({ dataDir: testDir, host: "127.0.0.1" });
      expect(server.getHost()).toBe("127.0.0.1");
    });
  });

  describe("server start/stop", () => {
    it("should start the server on the specified port", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3333 });
      const url = await server.start();
      expect(url).toBe("http://localhost:3333");
      expect(server.isRunning()).toBe(true);
    });

    it("should stop the server gracefully", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3334 });
      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.close();
      expect(server.isRunning()).toBe(false);
    });

    it("should find an available port if default is occupied", async () => {
      const server1 = new DashboardServer({ dataDir: testDir, port: 3335 });
      await server1.start();

      const server2 = new DashboardServer({ dataDir: testDir, port: 3335 });
      const url = await server2.start();

      expect(url).not.toBe("http://localhost:3335");
      expect(parseInt(url.split(":")[2])).toBeGreaterThan(3335);

      await server2.close();
      await server1.close();
    });
  });

  describe("static file serving", () => {
    it("should serve the dashboard HTML", async () => {
      // Create a mock index.html
      const uiDir = path.join(testDir, "ui", "dashboard");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, "index.html"), "<html>Dashboard</html>");

      server = new DashboardServer({ dataDir: testDir, port: 3336 });
      await server.start();

      const response = await fetch("http://localhost:3336/");
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("Dashboard");
    });

    it("should serve static assets", async () => {
      const assetsDir = path.join(testDir, "ui", "dashboard", "assets");
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(path.join(assetsDir, "style.css"), "body { color: red; }");

      server = new DashboardServer({ dataDir: testDir, port: 3337 });
      await server.start();

      const response = await fetch("http://localhost:3337/assets/style.css");
      expect(response.status).toBe(200);
    });

    it("should return 404 for non-existent files", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3338 });
      await server.start();

      const response = await fetch("http://localhost:3338/nonexistent.html");
      expect(response.status).toBe(404);
    });
  });

  describe("health endpoint", () => {
    it("should expose a health check endpoint", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3339 });
      await server.start();

      const response = await fetch("http://localhost:3339/health");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("ok");
    });
  });

  describe("error handling", () => {
    it("should throw if server is already running", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3350 });
      await server.start();

      await expect(server.start()).rejects.toThrow("Server is already running");
    });

    it("should handle close when not running", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3351 });
      // Should not throw
      await expect(server.close()).resolves.toBeUndefined();
    });

    it("should return undefined for getActualPort when not started", () => {
      server = new DashboardServer({ dataDir: testDir, port: 3352 });
      expect(server.getActualPort()).toBeUndefined();
    });

    it("should expose getApp for testing", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3353 });
      expect(server.getApp()).toBeDefined();
    });

    it("should return null for getIO when not started", () => {
      server = new DashboardServer({ dataDir: testDir, port: 3354 });
      expect(server.getIO()).toBeNull();
    });

    it("should return IO instance when started", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3355 });
      await server.start();
      expect(server.getIO()).toBeDefined();
      expect(server.getIO()).not.toBeNull();
    });
  });
});
