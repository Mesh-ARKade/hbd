/**
 * Retry Utility with Exponential Backoff
 * 
 * Implements retry logic with exponential backoff and jitter for resilient operations.
 * Based on the design in openspec/changes/s5-resilience-observability/design.md
 */

import { ok, err, Result } from './result.js'

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number
  /** Function to determine if an error is retryable (default: all errors are retryable) */
  isRetryable?: (error: Error) => boolean
  /** Callback fired on each retry */
  onRetry?: (attempt: number, error: Error) => void
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

interface RetryOptionsInternal {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  isRetryable: (error: Error) => boolean
  onRetry?: (attempt: number, error: Error) => void
}

const DEFAULT_OPTIONS: RetryOptionsInternal = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  isRetryable: () => true,
}

/**
 * Calculates the delay with exponential backoff and jitter
 * Exported for testing
 */
export function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  // Exponential backoff: baseDelay * 2^(attempt-1)
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
  // Add jitter first (0-25% of delay)
  const jitter = exponentialDelay * Math.random() * 0.25
  const withJitter = exponentialDelay + jitter
  // Cap at max delay
  return Math.floor(Math.min(withJitter, maxDelayMs))
}

/**
 * Retries an async operation with exponential backoff
 * 
 * @param operation - The async operation to retry
 * @param options - Retry configuration options
 * @returns Result containing the operation result or error after all attempts exhausted
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<Result<T, RetryError>> {
  const opts: RetryOptionsInternal = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  let lastError: Error | undefined = undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const value = await operation()
      return ok(value)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry - only if more attempts AND error is retryable
      if (attempt < opts.maxAttempts && opts.isRetryable(lastError)) {
        // Fire retry callback if provided
        opts.onRetry?.(attempt, lastError)

        // Calculate and wait for the delay
        const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs)
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else if (!opts.isRetryable(lastError)) {
        // Non-retryable error - fail immediately
        return err(
          new RetryError(
            `Non-retryable error: ${lastError.message}`,
            attempt,
            lastError
          )
        )
      }
    }
  }

  // All attempts exhausted
  return err(
    new RetryError(
      `Failed after ${opts.maxAttempts} attempts: ${lastError?.message}`,
      opts.maxAttempts,
      lastError!
    )
  )
}