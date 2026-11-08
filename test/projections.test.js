import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjection, buildWasteEstimate } from '../public/assets/domain/projections.js'
import { buildDailySeries, makeReading } from '../public/assets/domain/readings.js'
import { fixtureReadings } from './fixtures/mediciones.js'
import { defaultTariffs } from '../public/assets/domain/tariffs.js'
import { buildCycles, currentCycle } from '../public/assets/domain/cycles.js'
import { calcBill } from '../public/assets/domain/billing.js'
import { HOUSE2_LEAK_LPD, HOUSE2_LEAK_LPH } from '../public/assets/domain/constants.js'
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

describe('estimated waste against the House 1 baseline', () => {
  it('compares the cycle with House 1 alone using the frozen fixture', () => {
    closeTo(projection.waste.baselineDailyM3, 0.395, 3)
    closeTo(projection.waste.baselineCycleM3, 12.245, 3)
    assert.equal(projection.waste.baselineBillableM3, 12)
    closeTo(projection.waste.baselineBill.total, 13676, 2)
    closeTo(projection.waste.leakDailyM3, 0.432, 3)
    closeTo(projection.waste.leakCycleM3, 13.392, 3)
    closeTo(projection.waste.excessSoFarM3, 1.9765, 3)
    assert.ok(projection.waste.projectedWasteM3 > 0)
    assert.ok(projection.waste.projectedWasteColon > 0)
  })

  it('matches the real 08-Nov sheet and the measured leak', () => {
    // Real sheet: base 100.156 (19-Oct 21:50), 08-Nov 09:00 reading 114.190.
    // Leak test: 15:00 114.801 -> 15:30 114.810 = 9 L in 30 min = 18 L/h.
    closeTo(((114.810 - 114.801) * 1000) / 0.5, HOUSE2_LEAK_LPH, 0)
    closeTo(HOUSE2_LEAK_LPD, 432, 0)

    const real = [
      makeReading({ at: '2026-10-19T21:50:00-06:00', value: 100.156 }),
      makeReading({ at: '2026-10-20T10:05:00-06:00', value: 100.283 }),
      makeReading({ at: '2026-11-08T09:00:00-06:00', value: 114.19 }),
    ]
    const at = new Date('2026-11-08T09:00:00-06:00')
    const realCycle = currentCycle(buildCycles(real, at), at)
    const result = buildProjection({
      cycle: realCycle,
      readings: real,
      days: buildDailySeries(real),
      tariffs,
      now: at,
    })

    closeTo(result.currentExactM3, 14.034, 3)
    closeTo(result.waste.excessSoFarM3, 6.381, 3)
  })

  it('never reports a negative waste', () => {
    const waste = buildWasteEstimate({
      currentExactM3: 1,
      elapsedDays: 4.5,
      totalDays: 31,
      projectedM3: 5,
      projectedBill: calcBill(5, tariffs),
      tariffs,
    })
    assert.equal(waste.excessSoFarM3, 0)
    assert.equal(waste.projectedWasteM3, 0)
    assert.equal(waste.projectedWasteColon, 0)
  })
})
