import { describe, it, expect } from 'vitest'
import { retry, RetryOptions, RetryError, calculateDelay } from '../src/core/retry'

describe('retry', () => {
  describe('successful operation', () => {
    it('should return the result on first try if successful', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const result = await retry(operation)

      expect(result.ok).toBe(true)
      expect(result.value).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('failed operation with retries', () => {
    it('should fail after max attempts exhausted', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('always fails'))

      const options: RetryOptions = {
        maxAttempts: 3,
        baseDelayMs: 0, // No delay for tests
        maxDelayMs: 0,
      }

      const result = await retry(operation, options)

      expect(result.ok).toBe(false)
      expect((result as any).error).toBeInstanceOf(RetryError)
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('non-retryable'))

      const options: RetryOptions = {
        maxAttempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
        isRetryable: (error) => error.message !== 'non-retryable',
      }

      const result = await retry(operation, options)

      expect(result.ok).toBe(false)
      // Should NOT retry - should fail on first attempt
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('default options', () => {
    it('should use default options if not provided', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const result = await retry(operation)

      expect(result.ok).toBe(true)
    })
  })

  describe('calculateDelay', () => {
    it('should return base delay on first attempt', () => {
      const delay = calculateDelay(1, 100, 1000)
      // Base delay with jitter (0-25%)
      expect(delay).toBeGreaterThanOrEqual(100)
      expect(delay).toBeLessThanOrEqual(125)
    })

    it('should double delay on subsequent attempts', () => {
      const delay1 = calculateDelay(1, 100, 1000)
      const delay2 = calculateDelay(2, 100, 1000)
      
      // Second attempt should be roughly double (with jitter)
      expect(delay2).toBeGreaterThan(delay1)
    })

    it('should cap at maxDelayMs', () => {
      const delay = calculateDelay(10, 100, 500)
      expect(delay).toBeLessThanOrEqual(500)
    })
  })
})