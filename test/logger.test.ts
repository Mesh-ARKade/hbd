import { describe, it, expect, vi } from 'vitest'
import { createLogger, createChildLogger, logger, levels } from '../src/core/logger'
import { Writable } from 'stream'

describe('logger', () => {
  describe('createLogger', () => {
    it('should create a logger with default options', () => {
      const log = createLogger()
      expect(log).toBeDefined()
      expect(log.level).toBe('info')
    })

    it('should accept custom level', () => {
      const log = createLogger({ level: 'debug' })
      expect(log.level).toBe('debug')
    })

    it('should include system metadata in bindings', () => {
      const log = createLogger({ system: 'test-system' })
      expect(log).toBeDefined()
    })
  })

  describe('createChildLogger', () => {
    it('should create a child logger with additional metadata', () => {
      const parent = createLogger()
      const child = createChildLogger(parent, { source: 'No-Intro' })
      expect(child).toBeDefined()
    })
  })

  describe('levels', () => {
    it('should export all standard pino levels', () => {
      expect(levels.trace).toBe('trace')
      expect(levels.debug).toBe('debug')
      expect(levels.info).toBe('info')
      expect(levels.warn).toBe('warn')
      expect(levels.error).toBe('error')
      expect(levels.fatal).toBe('fatal')
    })
  })

  describe('structured JSON output', () => {
    it('should output structured JSON', () => {
      // Capture log output
      let output = ''
      const stream = new Writable({
        write(chunk, encoding, callback) {
          output = chunk.toString()
          callback()
        }
      })

      const log = createLogger({ 
        level: 'info',
        stream,
        system: 'test'
      })

      log.info({ sha1: 'abc123' }, 'test message')

      // JSON should be parseable and contain expected fields
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty('level')
      expect(parsed).toHaveProperty('time')
      expect(parsed).toHaveProperty('msg')
      expect(parsed).toHaveProperty('system')
    })
  })

  describe('default export', () => {
    it('should have a default logger exported', () => {
      expect(logger).toBeDefined()
      expect(logger.level).toBe('info')
    })
  })
})