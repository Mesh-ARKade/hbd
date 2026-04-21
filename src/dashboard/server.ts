/**
 * DashboardServer - Fastify-based local server with static file serving and Socket.io.
 * Provides the backend for the HBD real-time dashboard.
 * @packageDocumentation
 */

import Fastify, { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { Server as SocketIOServer, Socket } from "socket.io";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createLogger } from "../core/logger.js";
import type { Logger } from "pino";

export interface DashboardServerOptions {
  /** Data directory path */
  dataDir: string;
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Host to bind to (default: localhost) */
  host?: string;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Fastify-based dashboard server with static file serving and Socket.io.
 */
export class DashboardServer {
  private app: FastifyInstance;
  private io: SocketIOServer | null = null;
  private port: number;
  private host: string;
  private dataDir: string;
  private logger: Logger;
  private running: boolean = false;
  private actualPort?: number;

  constructor(options: DashboardServerOptions) {
    this.port = options.port ?? 3000;
    this.host = options.host ?? "localhost";
    this.dataDir = options.dataDir;
    this.logger =
      options.logger ?? createLogger({ system: "dashboard", level: "info" });

    this.app = Fastify({
      logger: false, // We use our own logger
    });

    this.setupRoutes();
    this.setupStaticFiles();
  }

  /**
   * Copy UI files from source directory to data directory.
   */
  private copyUiFiles(sourceDir: string, targetDir: string): void {
    if (!fs.existsSync(sourceDir)) {
      this.logger.warn("Source UI directory not found, skipping copy");
      return;
    }

    const copyRecursive = (src: string, dest: string): void => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          // Only copy if file doesn't exist or is different
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
            this.logger.debug({ file: entry.name }, "Copied UI file");
          }
        }
      }
    };

    try {
      copyRecursive(sourceDir, targetDir);
    } catch (error) {
      this.logger.error({ error }, "Failed to copy UI files");
    }
  }

  /**
   * Setup API routes.
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", async () => {
      return { status: "ok", timestamp: Date.now() };
    });
  }

  /**
   * Setup static file serving for the dashboard UI.
   */
  private setupStaticFiles(): void {
    const uiDir = path.resolve(path.join(this.dataDir, "ui", "dashboard"));
    const sourceDir = path.resolve(path.join(__dirname, "..", "ui", "dashboard"));

    // Ensure the directory exists
    if (!fs.existsSync(uiDir)) {
      fs.mkdirSync(uiDir, { recursive: true });
    }

    // Copy UI files from source if they don't exist in dataDir
    this.copyUiFiles(sourceDir, uiDir);

    // Register static file plugin
    this.app.register(fastifyStatic, {
      root: uiDir,
      prefix: "/",
    });

    // Serve index.html for root path
    this.app.get("/", async (request, reply) => {
      const indexPath = path.join(uiDir, "index.html");
      if (fs.existsSync(indexPath)) {
        return reply.sendFile("index.html");
      }
      return reply
        .code(404)
        .send({ error: "Dashboard not built. Run hbd dashboard --build" });
    });
  }

  /**
   * Setup Socket.io event handlers.
   */
  private setupSocketIO(): void {
    if (!this.io) return;

    this.io.on("connection", (socket: Socket) => {
      this.logger.debug({ socketId: socket.id }, "Client connected");

      // Send connection acknowledgment
      socket.emit("connection:ack", {
        socketId: socket.id,
        timestamp: Date.now(),
      });

      // Handle room joining
      socket.on("room:join", (room: string) => {
        socket.join(room);
        socket.emit("room:joined", { room, socketId: socket.id });
        this.logger.debug({ socketId: socket.id, room }, "Client joined room");
      });

      // Handle room leaving
      socket.on("room:leave", (room: string) => {
        socket.leave(room);
        socket.emit("room:left", { room, socketId: socket.id });
        this.logger.debug({ socketId: socket.id, room }, "Client left room");
      });

      socket.on("disconnect", () => {
        this.logger.debug({ socketId: socket.id }, "Client disconnected");
      });
    });
  }

  /**
   * Start the server.
   * @returns The URL the server is listening on
   */
  async start(): Promise<string> {
    if (this.running) {
      throw new Error("Server is already running");
    }

    try {
      await this.app.listen({ port: this.port, host: this.host });
      this.actualPort = this.port;
      this.running = true;

      // Initialize Socket.io
      this.io = new SocketIOServer(this.app.server!, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
        },
      });
      this.setupSocketIO();

      const url = `http://${this.host}:${this.actualPort}`;
      this.logger.info({ port: this.actualPort, url }, "Dashboard server started");
      return url;
    } catch (error: any) {
      if (error.code === "EADDRINUSE") {
        // Port is occupied, try to find an available one
        this.logger.warn({ port: this.port }, "Port occupied, finding available port");
        return this.findAndStartOnAvailablePort();
      }
      throw error;
    }
  }

  /**
   * Find an available port and start the server.
   */
  private async findAndStartOnAvailablePort(): Promise<string> {
    const maxAttempts = 10;
    let currentPort = this.port + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.app.listen({ port: currentPort, host: this.host });
        this.actualPort = currentPort;
        this.running = true;

        // Initialize Socket.io
        this.io = new SocketIOServer(this.app.server!, {
          cors: {
            origin: "*",
            methods: ["GET", "POST"],
          },
        });
        this.setupSocketIO();

        const url = `http://${this.host}:${this.actualPort}`;
        this.logger.info({ port: this.actualPort, url }, "Dashboard server started on available port");
        return url;
      } catch (error: any) {
        if (error.code === "EADDRINUSE") {
          currentPort++;
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Could not find available port after ${maxAttempts} attempts`);
  }

  /**
   * Stop the server.
   */
  async close(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.io) {
      this.io.close();
      this.io = null;
    }

    await this.app.close();
    this.running = false;
    this.logger.info("Dashboard server stopped");
  }

  /**
   * Broadcast state update to all connected clients.
   */
  broadcastState(state: unknown): void {
    if (!this.io) return;
    this.io.emit("state:update", state);
  }

  /**
   * Broadcast log entry to all connected clients.
   */
  broadcastLog(log: unknown): void {
    if (!this.io) return;
    this.io.emit("log:entry", log);
  }

  /**
   * Get the configured port.
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the configured host.
   */
  getHost(): string {
    return this.host;
  }

  /**
   * Get the actual port the server is listening on.
   */
  getActualPort(): number | undefined {
    return this.actualPort;
  }

  /**
   * Check if the server is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the Fastify instance (for testing).
   */
  getApp(): FastifyInstance {
    return this.app;
  }

  /**
   * Get the Socket.io instance (for testing).
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}
