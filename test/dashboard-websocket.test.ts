/**
 * Tests for DashboardServer Socket.io integration.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { io, Socket } from "socket.io-client";
import { DashboardServer } from "../src/dashboard/server.js";
import { getUniqueTestDir, robustRm } from "./test-utils.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("DashboardServer WebSocket", () => {
  let server: DashboardServer;
  let testDir: string;
  let clientSocket: Socket;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-dashboard-ws");
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.close();
    }
    if (server) {
      await server.close();
    }
    await robustRm(testDir);
  });

  describe("connection", () => {
    it("should accept socket.io connections", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3340 });
      await server.start();

      // Create UI dir and minimal index.html
      const uiDir = path.join(testDir, "ui", "dashboard");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, "index.html"), "<html></html>");

      // Connect via Socket.io
      clientSocket = io("http://localhost:3340");

      await new Promise<void>((resolve, reject) => {
        clientSocket.on("connect", () => {
          resolve();
        });
        clientSocket.on("connect_error", (err) => {
          reject(err);
        });
        // Timeout fallback
        setTimeout(() => reject(new Error("Connection timeout")), 3000);
      });

      expect(clientSocket.connected).toBe(true);
    });

    it("should emit connection acknowledgment", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3341 });
      await server.start();

      const uiDir = path.join(testDir, "ui", "dashboard");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, "index.html"), "<html></html>");

      clientSocket = io("http://localhost:3341");

      const ack = await new Promise<any>((resolve) => {
        clientSocket.on("connection:ack", (data) => {
          resolve(data);
        });
      });

      expect(ack).toBeDefined();
      expect(ack.timestamp).toBeDefined();
    });
  });

  describe("room joining", () => {
    it("should allow clients to join the dashboard room", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3342 });
      await server.start();

      const uiDir = path.join(testDir, "ui", "dashboard");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, "index.html"), "<html></html>");

      clientSocket = io("http://localhost:3342");

      await new Promise<void>((resolve) => {
        clientSocket.on("connect", resolve);
      });

      clientSocket.emit("room:join", "dashboard");

      const confirmation = await new Promise<any>((resolve) => {
        clientSocket.on("room:joined", (data) => {
          resolve(data);
        });
      });

      expect(confirmation.room).toBe("dashboard");
    });
  });

  describe("state updates", () => {
    it("should broadcast state updates to connected clients", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3343 });
      await server.start();

      const uiDir = path.join(testDir, "ui", "dashboard");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, "index.html"), "<html></html>");

      clientSocket = io("http://localhost:3343");

      await new Promise<void>((resolve) => {
        clientSocket.on("connect", resolve);
      });

      // Simulate state update
      const testState = {
        pipelines: [{ id: "test", status: "running", progress: 50 }],
      };

      server.broadcastState(testState);

      const update = await new Promise<any>((resolve) => {
        clientSocket.on("state:update", (data) => {
          resolve(data);
        });
      });

      expect(update).toEqual(testState);
    });
  });

  describe("log streaming", () => {
    it("should stream logs to connected clients", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3344 });
      await server.start();

      const uiDir = path.join(testDir, "ui", "dashboard");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, "index.html"), "<html></html>");

      clientSocket = io("http://localhost:3344");

      await new Promise<void>((resolve) => {
        clientSocket.on("connect", resolve);
      });

      const testLog = {
        level: 30,
        time: Date.now(),
        msg: "Test log message",
      };

      server.broadcastLog(testLog);

      const log = await new Promise<any>((resolve) => {
        clientSocket.on("log:entry", (data) => {
          resolve(data);
        });
      });

      expect(log.msg).toBe("Test log message");
    });
  });

  describe("room management", () => {
    it("should allow clients to leave rooms", async () => {
      server = new DashboardServer({ dataDir: testDir, port: 3345 });
      await server.start();

      const uiDir = path.join(testDir, "ui", "dashboard");
      fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, "index.html"), "<html></html>");

      clientSocket = io("http://localhost:3345");

      await new Promise<void>((resolve) => {
        clientSocket.on("connect", resolve);
      });

      clientSocket.emit("room:join", "test-room");
      await new Promise<void>((resolve) => {
        clientSocket.on("room:joined", () => resolve());
      });

      clientSocket.emit("room:leave", "test-room");

      const confirmation = await new Promise<any>((resolve) => {
        clientSocket.on("room:left", (data) => {
          resolve(data);
        });
      });

      expect(confirmation.room).toBe("test-room");
    });
  });

  describe("broadcast when not connected", () => {
    it("should handle broadcastState when server is not running", () => {
      server = new DashboardServer({ dataDir: testDir, port: 3346 });
      // Should not throw
      server.broadcastState({ test: true });
    });

    it("should handle broadcastLog when server is not running", () => {
      server = new DashboardServer({ dataDir: testDir, port: 3347 });
      // Should not throw
      server.broadcastLog({ msg: "test" });
    });
  });
});
