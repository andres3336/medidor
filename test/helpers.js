import assert from 'node:assert/strict'

/** Same tolerance rule as Vitest's `toBeCloseTo(value, digits)`. */
export function closeTo(actual, expected, digits = 2) {
  const tolerance = 10 ** -digits / 2
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be close to ${expected} (±${tolerance})`,
  )
}
