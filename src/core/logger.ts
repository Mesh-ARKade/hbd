/**
 * Centralized Pino Logger Factory
 * 
 * Provides a pre-configured Pino instance with standardized logging levels
 * and automatic metadata injection (e.g., sha1, source, system).
 * Based on the design in openspec/changes/s5-resilience-observability/design.md
 */

import pino, { Logger, LoggerOptions, DestinationStream } from 'pino'

export interface HbdLoggerOptions extends LoggerOptions {
  /** System identifier (e.g., 'hbd', 'storage', 'p2p') */
  system?: string
  /** Source identifier (e.g., 'No-Intro', 'Redump') */
  source?: string
  /** SHA1 of the hypercore being operated on */
  sha1?: string
  /** Minimum level to log (default: 'info') */
  level?: pino.Level
  /** Output stream (default: process.stdout) */
  stream?: DestinationStream
}

const DEFAULT_LEVEL: pino.Level = 'info'

/**
 * Creates a configured HBD logger instance
 */
export function createLogger(options: HbdLoggerOptions = {}): Logger {
  const {
    system = 'hbd',
    source,
    sha1,
    level = DEFAULT_LEVEL,
    stream,
    ...pinoOptions
  } = options

  // Build default metadata that will be included in all logs
  const baseMetadata: Record<string, string> = {
    system,
  }

  if (source) baseMetadata.source = source
  if (sha1) baseMetadata.sha1 = sha1

  const logger = pino(
    {
      ...pinoOptions,
      level,
      formatters: {
        ...pinoOptions.formatters,
        bindings: () => baseMetadata,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream
  )

  return logger
}

/**
 * Creates a child logger with additional metadata
 */
export function createChildLogger(
  parent: Logger,
  metadata: { source?: string; sha1?: string; [key: string]: string | undefined }
): Logger {
  return parent.child(metadata)
}

/**
 * Default HBD logger instance
 */
export const logger = createLogger()

// Export pino levels for type safety
export const levels = {
  trace: 'trace' as pino.Level,
  debug: 'debug' as pino.Level,
  info: 'info' as pino.Level,
  warn: 'warn' as pino.Level,
  error: 'error' as pino.Level,
  fatal: 'fatal' as pino.Level,
}