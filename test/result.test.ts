import { describe, it, expect } from 'vitest'
import { ok, err, isOk, isErr, map, mapErr, unwrap, unwrapOr, unwrapErr } from '../src/core/result'

describe('Result', () => {
  describe('ok()', () => {
    it('should create a successful Result with a value', () => {
      const result = ok(42)
      expect(isOk(result)).toBe(true)
      expect(isErr(result)).toBe(false)
      expect(result.value).toBe(42)
    })
  })

  describe('err()', () => {
    it('should create an error Result with an error', () => {
      const result = err('something went wrong')
      expect(isOk(result)).toBe(false)
      expect(isErr(result)).toBe(true)
      expect(result.error).toBe('something went wrong')
    })
  })

  describe('isOk()', () => {
    it('should return true for successful Result', () => {
      const result = ok('success')
      expect(isOk(result)).toBe(true)
    })

    it('should return false for error Result', () => {
      const result = err('fail')
      expect(isOk(result)).toBe(false)
    })
  })

  describe('isErr()', () => {
    it('should return false for successful Result', () => {
      const result = ok('success')
      expect(isErr(result)).toBe(false)
    })

    it('should return true for error Result', () => {
      const result = err('fail')
      expect(isErr(result)).toBe(true)
    })
  })

  describe('map()', () => {
    it('should transform the value if ok', () => {
      const result = ok(10)
      const mapped = map(result, (v) => v * 2)
      expect(isOk(mapped)).toBe(true)
      expect((mapped as any).value).toBe(20)
    })

    it('should pass through the error if err', () => {
      const result = err('fail')
      const mapped = map(result, (v) => v * 2)
      expect(isErr(mapped)).toBe(true)
      expect(mapped.error).toBe('fail')
    })
  })

  describe('mapErr()', () => {
    it('should pass through the value if ok', () => {
      const result = ok(10)
      const mapped = mapErr(result, (e) => e.toUpperCase())
      expect(isOk(mapped)).toBe(true)
      expect((mapped as any).value).toBe(10)
    })

    it('should transform the error if err', () => {
      const result = err('fail')
      const mapped = mapErr(result, (e) => e.toUpperCase())
      expect(isErr(mapped)).toBe(true)
      expect(mapped.error).toBe('FAIL')
    })
  })

  describe('unwrap()', () => {
    it('should return the value if ok', () => {
      const result = ok(42)
      expect(unwrap(result)).toBe(42)
    })

    it('should throw if error', () => {
      const result = err('oops')
      expect(() => unwrap(result)).toThrow('oops')
    })
  })

  describe('unwrapOr()', () => {
    it('should return the value if ok', () => {
      const result = ok(42)
      expect(unwrapOr(result, 0)).toBe(42)
    })

    it('should return the default if err', () => {
      const result = err('oops')
      expect(unwrapOr(result, 0)).toBe(0)
    })
  })

  describe('unwrapErr()', () => {
    it('should return the error if err', () => {
      const result = err('oops')
      expect(unwrapErr(result)).toBe('oops')
    })

    it('should throw if ok', () => {
      const result = ok(42)
      expect(() => unwrapErr(result)).toThrow('Tried to unwrapErr on an Ok')
    })
  })

  describe('type exports', () => {
    it('should export Result type', () => {
      const okResult: Result<number, string> = ok(42)
      const errResult: Result<number, string> = err('fail')
      expect(okResult.ok).toBe(true)
      expect(errResult.ok).toBe(false)
    })
  })
})