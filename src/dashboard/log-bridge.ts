/**
 * LogBridge - Captures Pino logs and broadcasts to websocket clients.
 * Provides real-time log streaming to the dashboard.
 * @packageDocumentation
 */

import pino, { Logger, LoggerOptions } from "pino";

/** Log level names to Pino level numbers */
const LOG_LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/** Options for LogBridge constructor */
export interface LogBridgeOptions {
  /** Function to broadcast logs to websocket clients */
  broadcast: (logEntry: LogEntry) => void;
  /** Minimum log level to broadcast (default: "debug") */
  minLevel?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  /** Maximum history buffer size (default: 100) */
  maxHistory?: number;
  /** Additional logger options */
  loggerOptions?: LoggerOptions;
}

/** Log entry structure */
export interface LogEntry {
  /** Log level (10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal) */
  level: number;
  /** Timestamp in milliseconds */
  time: number;
  /** Log message */
  msg: string;
  /** Additional properties */
  [key: string]: unknown;
}

/**
 * Bridges Pino logger with websocket broadcasting.
 * Maintains a history buffer for new connections.
 */
export class LogBridge {
  private logger: Logger;
  private broadcast: (logEntry: LogEntry) => void;
  private minLevel: number;
  private maxHistory: number;
  private history: LogEntry[] = [];

  constructor(options: LogBridgeOptions) {
    this.broadcast = options.broadcast;
    this.minLevel = LOG_LEVELS[options.minLevel ?? "debug"];
    this.maxHistory = options.maxHistory ?? 100;

    // Create Pino logger with custom transport
    this.logger = pino({
      ...options.loggerOptions,
      level: options.minLevel ?? "debug",
      timestamp: pino.stdTimeFunctions.epochTime,
      hooks: {
        logMethod: (inputArgs, method, level) => {
          // Call original method with proper context
          // Pino expects (obj: object, message: string) or (message: string)
          const obj = inputArgs[0];
          const msg = inputArgs[1] as string | undefined;
          
          if (typeof obj === "object" && obj !== null) {
            const rest = inputArgs.slice(2);
            (method as (obj: object, msg: string, ...args: unknown[]) => void)
              .call(this.logger, obj, msg ?? "", ...rest);
          } else {
            // First arg is the message string, preserve all following args
            const rest = inputArgs.slice(1);
            (method as (msg: string, ...args: unknown[]) => void)
              .call(this.logger, obj as string, ...rest);
          }

          // Broadcast if level meets minimum
          if (level >= this.minLevel) {
            this.handleLog(level, inputArgs);
          }
        },
      },
    });
  }

  /**
   * Process and broadcast a log entry.
   */
  private handleLog(level: number, args: unknown[]): void {
    const logEntry = this.formatLogEntry(level, args);

    // Add to history buffer
    this.history.push(logEntry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Broadcast to clients
    this.broadcast(logEntry);
  }

  /**
   * Format log arguments into a structured entry.
   */
  private formatLogEntry(level: number, args: unknown[]): LogEntry {
    const time = Date.now();
    let msg = "";
    const properties: Record<string, unknown> = {};

    for (const arg of args) {
      if (typeof arg === "string") {
        msg = arg;
      } else if (typeof arg === "object" && arg !== null) {
        Object.assign(properties, arg);
      }
    }

    return {
      level,
      time,
      msg,
      ...properties,
    };
  }

  /**
   * Get the logger instance.
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Create a child logger with bound context.
   * The context will be included in all log entries.
   */
  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }

  /**
   * Get log history for new connections.
   */
  getHistory(): LogEntry[] {
    return [...this.history];
  }

  /**
   * Clear log history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get history as formatted strings for terminal display.
   */
  getFormattedHistory(): string[] {
    return this.history.map((entry) => {
      const levelName = this.getLevelName(entry.level);
      const time = new Date(entry.time).toISOString();
      return `[${time}] ${levelName}: ${entry.msg}`;
    });
  }

  /**
   * Get human-readable level name.
   */
  private getLevelName(level: number): string {
    const names: Record<number, string> = {
      10: "TRACE",
      20: "DEBUG",
      30: "INFO",
      40: "WARN",
      50: "ERROR",
      60: "FATAL",
    };
    return names[level] ?? "UNKNOWN";
  }
}
