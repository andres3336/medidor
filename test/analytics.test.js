import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureState } from './fixtures/mediciones.js'
import { deriveAnalytics } from '../public/assets/domain/analytics.js'
import { closeTo } from './helpers.js'

const state = fixtureState()
const now = new Date('2026-10-24T12:00:00-06:00')
const analytics = deriveAnalytics(state, now)

describe('app derivatives', () => {
  it('builds the current cycle with the Oct 19 base and consumption', () => {
    assert.equal(analytics.cycle.id, '2026-10')
    assert.equal(analytics.cycle.baseValue, 100.156)
    assert.equal(analytics.billableM3, 3)
    closeTo(analytics.currentBill.total, 5819, 2)
    assert.equal(analytics.currentBill.displayTotal, 5819)
    closeTo(analytics.projection.currentExactM3, 3.754, 3)
  })

  it('computes outliers only in the recent window of each cycle', () => {
    assert.ok(Array.isArray(analytics.anomalies))
    assert.ok(analytics.anomalies.every((anomaly) => anomaly.multiplier > 0))
    assert.ok(!analytics.anomalies.some((anomaly) => anomaly.day.startsWith('2026-09-2')))
  })

  it('computes the daily average since the start of the cycle', () => {
    closeTo(analytics.averageM3PerDay, 0.834, 2)
  })

  it('computes the previous cycle daily average', () => {
    closeTo(analytics.previousCycleAverageM3PerDay, 0.908, 3)
  })

  it('does not invent missing days when there is a daily reading', () => {
    assert.deepEqual(analytics.gaps.missingDays, [])
    assert.equal(analytics.gaps.missingYesterday, false)
  })

  it('projects with the average of the last days of the cycle', () => {
    assert.notEqual(analytics.projection, null)
    assert.ok(analytics.projection.rateSampleDays > 0)
    assert.ok(analytics.projection.rateLitersPerDay > 0)
    assert.ok(analytics.projection.projectedM3 > analytics.projection.currentExactM3)
    assert.ok(analytics.projection.projectedBillableM3 >= analytics.projection.currentBillableM3)
  })

  it('flags outliers without depending on notes', () => {
    assert.ok(Array.isArray(analytics.anomalies))
    assert.ok(analytics.anomalies.every((anomaly) => anomaly.multiplier > 0))
  })
})
