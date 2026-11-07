import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjection } from '../public/assets/domain/projections.js'
import { buildDailySeries, makeReading } from '../public/assets/domain/readings.js'
import { fixtureReadings } from './fixtures/mediciones.js'
import { defaultTariffs } from '../public/assets/domain/tariffs.js'
import { buildCycles, currentCycle } from '../public/assets/domain/cycles.js'
import { closeTo } from './helpers.js'

const now = new Date('2026-10-24T12:00:00-06:00')
const readings = fixtureReadings()
const cycle = currentCycle(buildCycles(readings, now), now)
const days = buildDailySeries(readings)
const tariffs = defaultTariffs()
const projection = buildProjection({ cycle, readings, days, tariffs, now })

describe('end-of-cycle projection', () => {
  it('computes current consumption and a single projection', () => {
    assert.notEqual(projection, null)
    closeTo(projection.currentExactM3, 3.754, 3)
    assert.equal(projection.currentBillableM3, 3)
    closeTo(projection.currentBill.total, 5819, 2)
    assert.ok(projection.projectedM3 > projection.currentExactM3)
    assert.ok(projection.rateSampleDays > 0)
  })

  it('returns null when the cycle has no base', () => {
    const noBase = { ...cycle, baseValue: null, baseReadingAt: null }
    assert.equal(buildProjection({ cycle: noBase, readings, days, tariffs, now }), null)
  })

  it('detects the IVA crossing when the pace exceeds it', () => {
    const synthetic = Array.from({ length: 5 }, (_, index) =>
      makeReading({
        at: `2026-10-${String(20 + index).padStart(2, '0')}T08:00:00-06:00`,
        value: index * 2,
      }),
    )
    const syntheticDays = buildDailySeries(synthetic)
    const bigCycle = {
      id: '2026-10',
      label: '20-OCT – 20-NOV',
      startAt: '2026-10-20T00:00:00-06:00',
      endAt: '2026-11-20T00:00:00-06:00',
      baseValue: 0,
      baseReadingAt: null,
      finalReading: 8,
      finalReadingAt: '2026-10-24T08:00:00-06:00',
      readingsCount: 5,
      open: true,
    }
    const result = buildProjection({
      cycle: bigCycle,
      readings: synthetic,
      days: syntheticDays,
      tariffs,
      now,
    })
    assert.notEqual(result, null)
    assert.equal(result.projectedBill.crossesIvaThreshold, true)
  })
})
