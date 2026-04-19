/**
 * Result Pattern Implementation
 * 
 * A type-safe approach to handling success and failure without throwing exceptions.
 * Based on the design in openspec/changes/s5-resilience-observability/design.md
 * 
 * Structure: `{ ok: true, value: T } | { ok: false, error: E }`
 */

export interface Ok<T> {
  ok: true
  value: T
}

export interface Err<E> {
  ok: false
  error: E
}

export type Result<T, E = string> = Ok<T> | Err<E>

/**
 * Creates a successful Result with a value
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

/**
 * Creates an error Result with an error
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

/**
 * Type guard to check if a Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true
}

/**
 * Type guard to check if a Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false
}

/**
 * Maps a Result's value if Ok, passes through if Err
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value))
  }
  return err(result.error)
}

/**
 * Maps a Result's error if Err, passes through if Ok
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isOk(result)) {
    return ok(result.value)
  }
  return err(fn(result.error))
}

/**
 * Unwraps a Result, returning the value if Ok
 * @throws Error with the error message if Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value
  }
  throw new Error(String(result.error))
}

/**
 * Unwraps a Result, returning the value if Ok or a default if Err
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value
  }
  return defaultValue
}

/**
 * Unwraps a Result, returning the error if Err
 * @throws Error if Ok
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error
  }
  throw new Error('Tried to unwrapErr on an Ok')
}