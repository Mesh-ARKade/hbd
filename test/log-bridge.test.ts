/**
 * Tests for LogBridge - Pino-to-Websocket log streaming.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LogBridge } from "../src/dashboard/log-bridge.js";
import { Logger } from "pino";

describe("LogBridge", () => {
  let bridge: LogBridge;
  let mockBroadcast: ReturnType<typeof vi.fn>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockBroadcast = vi.fn();
    bridge = new LogBridge({ broadcast: mockBroadcast });
    mockLogger = bridge.getLogger();
  });

  describe("initialization", () => {
    it("should create a LogBridge instance", () => {
      expect(bridge).toBeDefined();
    });

    it("should return a Pino logger", () => {
      expect(mockLogger).toBeDefined();
      expect(typeof mockLogger.info).toBe("function");
      expect(typeof mockLogger.error).toBe("function");
      expect(typeof mockLogger.debug).toBe("function");
      expect(typeof mockLogger.warn).toBe("function");
    });
  });

  describe("log streaming", () => {
    it("should broadcast info logs", () => {
      mockLogger.info("Test info message");

      expect(mockBroadcast).toHaveBeenCalled();
      const call = mockBroadcast.mock.calls[0][0];
      expect(call.level).toBe(30); // Pino info level
      expect(call.msg).toBe("Test info message");
    });

    it("should broadcast error logs", () => {
      mockLogger.error("Test error message");

      const call = mockBroadcast.mock.calls[0][0];
      expect(call.level).toBe(50); // Pino error level
      expect(call.msg).toBe("Test error message");
    });

    it("should broadcast warn logs", () => {
      mockLogger.warn("Test warning");

      const call = mockBroadcast.mock.calls[0][0];
      expect(call.level).toBe(40); // Pino warn level
    });

    it("should broadcast debug logs", () => {
      mockLogger.debug("Test debug");

      const call = mockBroadcast.mock.calls[0][0];
      expect(call.level).toBe(20); // Pino debug level
    });

    it("should include additional properties in logs", () => {
      mockLogger.info({ source: "test", progress: 50 }, "Progress update");

      const call = mockBroadcast.mock.calls[0][0];
      expect(call.source).toBe("test");
      expect(call.progress).toBe(50);
      expect(call.msg).toBe("Progress update");
    });
  });

  describe("log buffering", () => {
    it("should buffer recent logs", () => {
      // Generate 150 log entries
      for (let i = 0; i < 150; i++) {
        mockLogger.info(`Log entry ${i}`);
      }

      const history = bridge.getHistory();
      expect(history.length).toBeLessThanOrEqual(100); // Buffer size limit
      expect(history[history.length - 1].msg).toBe("Log entry 149"); // Most recent
    });

    it("should provide logs to new connections", () => {
      mockLogger.info("Earlier log");
      mockLogger.info("Recent log");

      const history = bridge.getHistory();
      expect(history.length).toBe(2);
      expect(history.some((log) => log.msg === "Earlier log")).toBe(true);
      expect(history.some((log) => log.msg === "Recent log")).toBe(true);
    });
  });

  describe("log filtering", () => {
    it("should filter by minimum level", () => {
      const filteredBridge = new LogBridge({
        broadcast: mockBroadcast,
        minLevel: "warn", // Only warn and above
      });
      const logger = filteredBridge.getLogger();

      logger.debug("Debug msg");
      logger.info("Info msg");
      logger.warn("Warn msg");
      logger.error("Error msg");

      // Should only have 2 broadcasts (warn and error)
      expect(mockBroadcast).toHaveBeenCalledTimes(2);
    });

    it("should include timestamp in logs", () => {
      mockLogger.info("Timestamp test");

      const call = mockBroadcast.mock.calls[0][0];
      expect(call.time).toBeDefined();
      expect(typeof call.time).toBe("number");
    });
  });



  describe("integration with PipelineStatus", () => {
    it("should log pipeline state changes", () => {
      // Simulate logging from pipeline status
      mockLogger.info({ source: "nointro", phase: "downloading" }, "Source started");

      const call = mockBroadcast.mock.calls[0][0];
      expect(call.source).toBe("nointro");
      expect(call.phase).toBe("downloading");
    });
  });

  describe("clear history", () => {
    it("should clear log history", () => {
      mockLogger.info("Message 1");
      mockLogger.info("Message 2");

      expect(bridge.getHistory().length).toBe(2);

      bridge.clearHistory();

      expect(bridge.getHistory().length).toBe(0);
    });
  });

  describe("formatted history", () => {
    it("should return formatted log strings", () => {
      mockLogger.info("Formatted test");

      const formatted = bridge.getFormattedHistory();
      expect(formatted.length).toBe(1);
      expect(formatted[0]).toContain("INFO");
      expect(formatted[0]).toContain("Formatted test");
    });

    it("should format different log levels", () => {
      mockLogger.debug("Debug message");
      mockLogger.error("Error message");

      const formatted = bridge.getFormattedHistory();
      expect(formatted[0]).toContain("DEBUG");
      expect(formatted[1]).toContain("ERROR");
    });
  });
});
