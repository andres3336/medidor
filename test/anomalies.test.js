import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeBaseline, detectAnomalies } from '../public/assets/domain/anomalies.js'
import { buildDailySeries, makeReading } from '../public/assets/domain/readings.js'
import { closeTo } from './helpers.js'

function reading(at, value, note = '') {
  return makeReading({ at, value, note })
}

function dayPoint(day, litersPerDay, note = '') {
  return {
    day,
    at: `${day}T08:00:00-06:00`,
    reading: 0,
    liters: litersPerDay,
    hours: 24,
    litersPerDay,
    gapDays: 0,
    note,
  }
}

describe('daily series and anomalies', () => {
  it('normalizes gaps in the daily series', () => {
    const readings = [
      reading('2026-10-01T08:00:00-06:00', 10),
      reading('2026-10-02T08:00:00-06:00', 10.3),
      reading('2026-10-05T08:00:00-06:00', 11.5),
    ]
    const days = buildDailySeries(readings)
    assert.equal(days.length, 2)
    assert.equal(days[0].day, '2026-10-02')
    closeTo(days[0].litersPerDay, 300, 0)
    assert.equal(days[1].day, '2026-10-05')
    closeTo(days[1].liters, 1200, 0)
    assert.equal(days[1].gapDays, 2)
    closeTo(days[1].litersPerDay, 400, 0)
  })

  it('computes median and band while ignoring outliers', () => {
    const days = Array.from({ length: 10 }, (_, index) =>
      dayPoint(`2026-10-${String(index + 1).padStart(2, '0')}`, 290),
    )
    days[9].litersPerDay = 1517
    const baseline = computeBaseline(days)
    assert.equal(baseline.median, 290)
    assert.equal(baseline.sufficient, true)
    assert.equal(baseline.p25, 290)
    assert.equal(baseline.p75, 290)
  })

  it('marks an insufficient baseline with few days and uses the cycle average', () => {
    const days = [dayPoint('2026-10-01', 100)]
    const baseline = computeBaseline(days, 150)
    assert.equal(baseline.sufficient, false)
    assert.equal(baseline.fallback, 'cycle-average')
    assert.equal(baseline.median, 150)
  })

  it('detects an outlier and its multiplier', () => {
    const days = Array.from({ length: 12 }, (_, index) =>
      dayPoint(
        `2026-10-${String(index + 1).padStart(2, '0')}`,
        290,
        index === 11 ? 'shower tap left open' : '',
      ),
    )
    days[11].litersPerDay = 1517
    days[11].liters = 1517
    const baseline = computeBaseline(days)
    const anomalies = detectAnomalies(days, baseline)
    assert.equal(anomalies.length, 1)
    closeTo(anomalies[0].multiplier, 5.2, 1)
    assert.equal(anomalies[0].severity, 'danger')
  })
})
