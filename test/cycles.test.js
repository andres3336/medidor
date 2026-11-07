import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCycles,
  currentCycle,
  cycleDayProgress,
  cycleLabelFor,
  cycleReadings,
  nextPeriodStart,
  periodStartFor,
} from '../public/assets/domain/cycles.js'
import { fixtureReadings } from './fixtures/mediciones.js'
import { dayKey } from '../public/assets/domain/dates.js'
import { closeTo } from './helpers.js'

const readings = fixtureReadings()
const now = new Date('2026-10-24T12:00:00-06:00')

describe('20 → 20 cycles', () => {
  it('locates the cycle start before and after the 20th', () => {
    assert.equal(dayKey(periodStartFor('2026-10-24T12:00:00-06:00')), '2026-10-20')
    assert.equal(dayKey(periodStartFor('2026-10-19T23:59:00-06:00')), '2026-09-20')
    assert.equal(dayKey(periodStartFor('2026-10-20T00:00:00-06:00')), '2026-10-20')
  })

  it('computes the next cutoff and the label', () => {
    assert.equal(dayKey(nextPeriodStart('2026-12-20T00:00:00-06:00')), '2027-01-20')
    assert.equal(cycleLabelFor('2026-10-20T00:00:00-06:00'), '20-OCT – 20-NOV')
  })

  it('uses the last reading before the 20th as the cycle base', () => {
    const cycles = buildCycles(readings, now)
    assert.deepEqual(
      cycles.map((cycle) => cycle.id),
      ['2026-09', '2026-10'],
    )

    const previous = cycles[0]
    assert.equal(previous.baseValue, 73)
    assert.equal(previous.finalReading, 100.156)
    assert.equal(previous.open, false)

    const current = cycles[1]
    assert.equal(current.baseValue, 100.156)
    assert.equal(current.baseReadingAt, '2026-10-19T21:50:00-06:00')
    assert.equal(current.finalReading, 103.91)
    assert.equal(current.open, true)
    assert.equal(currentCycle(cycles, now)?.id, '2026-10')
  })

  it('splits each cycle readings', () => {
    const cycles = buildCycles(readings, now)
    assert.equal(cycleReadings(readings, cycles[0]).length, 58)
    assert.equal(cycleReadings(readings, cycles[1]).length, 8)
    assert.equal(cycleReadings(readings, cycles[1])[0].value, 100.283)
  })

  it('treats the 20th at 00:00 as part of the new cycle', () => {
    const cycles = buildCycles(readings, now)
    assert.equal(cycleReadings(readings, cycles[1])[0].at, '2026-10-20T09:00:00-06:00')
  })

  it('editing the last reading of the 19th changes the base', () => {
    const edited = readings.map((reading) =>
      reading.at === '2026-10-19T21:50:00-06:00' ? { ...reading, value: 100.2 } : reading,
    )
    const cycles = buildCycles(edited, now)
    assert.equal(cycles[1].baseValue, 100.2)
  })

  it('returns a cycle without a base when there are no readings', () => {
    const cycles = buildCycles([], now)
    assert.equal(cycles.length, 1)
    assert.equal(cycles[0].id, '2026-10')
    assert.equal(cycles[0].baseValue, null)
  })

  it('computes cycle progress', () => {
    const cycle = currentCycle(buildCycles(readings, now), now)
    const progress = cycleDayProgress(cycle, new Date('2026-10-25T00:00:00-06:00'))
    closeTo(progress.elapsedDays, 5, 1)
    closeTo(progress.remainingDays, 26, 0)
  })
})
