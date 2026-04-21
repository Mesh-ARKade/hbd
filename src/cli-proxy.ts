/**
 * CLI-to-Dashboard Proxy
 * Allows CLI commands to interface with a running dashboard server.
 * @packageDocumentation
 */

import { Result, ok, err } from "./core/result.js";

/**
 * Check if the dashboard server is running on the given port.
 */
export async function isDashboardRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send a scrape request to the dashboard API.
 */
export async function sendScrapeRequest(
  sourceId: string,
  port: number
): Promise<Result<{ message: string }, Error>> {
  try {
    const response = await fetch(`http://localhost:${port}/api/pipeline/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      return err(new Error(errorData.error || `HTTP ${response.status}`));
    }

    const data = await response.json();
    return ok({ message: data.message || "Scrape started" });
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Update pipeline configuration via dashboard API.
 */
export async function updatePipelineConfig(
  maxConcurrent: number,
  port: number
): Promise<Result<{ maxConcurrent: number }, Error>> {
  try {
    const response = await fetch(`http://localhost:${port}/api/pipeline/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxConcurrent }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      return err(new Error(errorData.error || `HTTP ${response.status}`));
    }

    const data = await response.json();
    return ok({ maxConcurrent: data.maxConcurrent });
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
