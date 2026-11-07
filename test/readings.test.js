import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildIntervals, dedupeReadings, makeReading } from '../public/assets/domain/readings.js'
import { closeTo } from './helpers.js'

function reading(at, value, note = '') {
  return makeReading({ at, value, note })
}

describe('readings', () => {
  it('deduplicates and builds intervals', () => {
    const readings = dedupeReadings([
      reading('2026-10-23T08:15:00-06:00', 103.054, 'daily'),
      reading('2026-10-23T09:20:00-06:00', 103.077, 'extra'),
      reading('2026-10-23T09:20:00-06:00', 103.077, 'extra'),
    ])
    assert.equal(readings.length, 2)
    const intervals = buildIntervals(readings)
    assert.equal(intervals.length, 1)
    closeTo(intervals[0].liters, 23, 3)
    closeTo(intervals[0].hours, 1.0833, 3)
    closeTo(intervals[0].lph, 21.23, 2)
  })
})
