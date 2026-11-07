import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureReadings } from './fixtures/mediciones.js'
import { buildCycles, currentCycle } from '../public/assets/domain/cycles.js'
import { buildDailySeries } from '../public/assets/domain/readings.js'
import { buildProjection } from '../public/assets/domain/projections.js'
import { defaultTariffs } from '../public/assets/domain/tariffs.js'
import {
  buildBillComparison,
  buildBillSeries,
  buildCycleSeries,
  buildDailyComparison,
  buildDailyCycle,
  findBlockMilestones,
  trafficBand,
} from '../public/assets/domain/periods.js'
import { closeTo } from './helpers.js'

const now = new Date('2026-10-24T12:00:00-06:00')
const readings = fixtureReadings()
const cycles = buildCycles(readings, now)
const cycle = currentCycle(cycles, now)
const days = buildDailySeries(readings)
const projection = buildProjection({
  cycle,
  readings,
  days,
  tariffs: defaultTariffs(),
  now,
})

describe('daily cycle series', () => {
  it('includes every day and projects from the day after the last reading', () => {
    const daily = buildDailyCycle(cycle, days, projection, now, false)
    assert.equal(daily[0].day, '2026-10-20')
    assert.equal(daily.at(-1)?.day, '2026-11-19')
    assert.equal(daily.find((point) => point.day === '2026-10-20')?.kind, 'actual')
    assert.equal(daily.find((point) => point.day === '2026-10-24')?.kind, 'actual')
    assert.equal(daily.find((point) => point.day === '2026-11-19')?.kind, 'projected')
  })

  it('starts the projection tomorrow when there is a reading today', () => {
    const daily = buildDailyCycle(cycle, days, projection, now, true)
    assert.equal(daily.find((point) => point.day === '2026-10-24')?.kind, 'actual')
    assert.equal(daily.find((point) => point.day === '2026-10-25')?.kind, 'projected')
  })

  it('numbers cycle days from 1', () => {
    const daily = buildDailyCycle(cycle, days, projection, now, false)
    assert.equal(daily[0].dayNumber, 1)
    assert.equal(daily.at(-1)?.dayNumber, daily.length)
  })

  it('applies the 75/90 traffic light by percentage of the maximum', () => {
    assert.equal(trafficBand(75, 100), 'green')
    assert.equal(trafficBand(76, 100), 'yellow')
    assert.equal(trafficBand(90, 100), 'yellow')
    assert.equal(trafficBand(91, 100), 'red')
    assert.equal(trafficBand(null, 100), 'green')
  })

  it('accumulates one point per day with a reading', () => {
    const series = buildCycleSeries(cycle, readings, projection)
    assert.equal(series.points.length, 6)
    assert.equal(series.points[0].m3, 0)
    closeTo(series.totalM3, 3.754, 3)
    assert.ok(series.projected.length > 1)
  })

  it('converts the accumulated series into an estimated bill', () => {
    const bill = buildBillSeries(cycle, readings, projection, defaultTariffs())
    assert.equal(bill.points[0].amount, 3200)
    assert.equal(bill.totalAmount, 5819)
    assert.equal(bill.points.at(-1)?.amount, 5819)
    assert.equal(bill.projected.at(-1)?.amount, projection.projectedBill.displayTotal)
  })
})

describe('estimated bill comparison', () => {
  it('compares the current period with the previous one', () => {
    const comparison = buildBillComparison(cycles, readings, cycle, projection, defaultTariffs())
    assert.equal(comparison.previous?.cycle.id, '2026-09')
    assert.equal(comparison.previous?.totalAmount, 37559)
    assert.equal(comparison.current.totalAmount, 5819)
  })
})

describe('day-by-day comparison', () => {
  it('builds 32 days and aligns day with day', () => {
    const comparison = buildDailyComparison(cycle, cycles[0], days)
    assert.equal(comparison.maxDay, 32)
    assert.equal(comparison.days.length, 32)
    assert.deepEqual(
      comparison.days.map((point) => point.dayNumber),
      Array.from({ length: 32 }, (_, index) => index + 1),
    )
    assert.equal(comparison.days[0].dayNumber, 1)
    assert.equal(comparison.days[0].previousM3, null)
    assert.equal(comparison.days[0].currentM3, 0.249)
    assert.equal(comparison.days[0].higherThanPrevious, null)

    assert.equal(comparison.days[1].dayNumber, 2)
    assert.equal(comparison.days[1].previousM3, 1.635)
    assert.equal(comparison.days[1].currentM3, 0.846)
    assert.equal(comparison.days[1].higherThanPrevious, false)

    assert.equal(comparison.days[31].dayNumber, 32)
    assert.equal(comparison.days[31].previousM3, null)
    assert.equal(comparison.days[31].currentM3, null)
    assert.equal(comparison.days[31].previousAt, null)
    assert.equal(comparison.days[31].currentAt, null)
  })

  it('flags when the current day beats the same day of the previous cycle', () => {
    const previousCycle = {
      id: '2026-09',
      label: '20-SEP – 20-OCT',
      startAt: '2026-09-20T00:00:00-06:00',
      endAt: '2026-10-20T00:00:00-06:00',
      baseValue: 0,
      baseReadingAt: null,
      finalReading: null,
      finalReadingAt: null,
      readingsCount: 0,
      open: false,
    }
    const currentCycle = {
      id: '2026-10',
      label: '20-OCT – 20-NOV',
      startAt: '2026-10-20T00:00:00-06:00',
      endAt: '2026-11-20T00:00:00-06:00',
      baseValue: 0,
      baseReadingAt: null,
      finalReading: null,
      finalReadingAt: null,
      readingsCount: 0,
      open: true,
    }
    const syntheticDays = [
      {
        day: '2026-09-21',
        at: '2026-09-21T00:00:00-06:00',
        reading: 1,
        liters: 1000,
        hours: 24,
        litersPerDay: 1000,
        gapDays: 0,
        note: '',
      },
      {
        day: '2026-10-21',
        at: '2026-10-21T00:00:00-06:00',
        reading: 2,
        liters: 2000,
        hours: 24,
        litersPerDay: 2000,
        gapDays: 0,
        note: '',
      },
    ]

    const comparison = buildDailyComparison(currentCycle, previousCycle, syntheticDays, 2)
    assert.equal(comparison.days[1].dayNumber, 2)
    assert.equal(comparison.days[1].previousM3, 1)
    assert.equal(comparison.days[1].currentM3, 2)
    assert.equal(comparison.days[1].higherThanPrevious, true)
  })

  it('leaves days without a reading blank and does not project', () => {
    const comparison = buildDailyComparison(cycle, cycles[0], days)
    assert.equal(comparison.days[5].dayNumber, 6)
    assert.equal(comparison.days[5].previousM3, 0.487)
    assert.equal(comparison.days[5].currentM3, null)
    assert.equal(comparison.days[30].dayNumber, 31)
    assert.equal(comparison.days[30].previousM3, null)
    assert.equal(comparison.days[30].currentM3, null)
    assert.equal(comparison.days[29].currentM3, null)
  })
})

describe('block milestones', () => {
  it('marks the day the 2026-09 cycle reaches block 1', () => {
    const milestones = findBlockMilestones(cycles[0], readings, defaultTariffs())
    assert.equal(milestones.length, 1)
    assert.equal(milestones[0].block, 1)
    assert.equal(milestones[0].thresholdM3, 15)
    assert.equal(milestones[0].billableM3, 15)
    closeTo(milestones[0].m3, 15.028, 3)
    assert.equal(milestones[0].amount, 16295)
    assert.equal(Math.floor(milestones[0].index + 1), 16)
  })

  it('does not invent milestones when the cycle does not reach a block', () => {
    assert.deepEqual(findBlockMilestones(cycles[1], readings, defaultTariffs()), [])
  })

  it('marks each new block at its own point', () => {
    const synthetic = [
      { at: '2026-10-21T08:00:00-06:00', value: 10 },
      { at: '2026-10-23T08:00:00-06:00', value: 16 },
      { at: '2026-10-25T08:00:00-06:00', value: 32 },
      { at: '2026-10-27T08:00:00-06:00', value: 61 },
    ].map((item) => ({
      id: `r-${Date.parse(item.at)}-${item.value.toFixed(3)}`,
      at: item.at,
      value: item.value,
      note: '',
    }))
    const syntheticCycle = {
      id: '2026-10',
      label: '20-OCT – 20-NOV',
      startAt: '2026-10-20T00:00:00-06:00',
      endAt: '2026-11-20T00:00:00-06:00',
      baseValue: 0,
      baseReadingAt: null,
      finalReading: 61,
      finalReadingAt: '2026-10-27T08:00:00-06:00',
      readingsCount: 4,
      open: true,
    }
    const milestones = findBlockMilestones(syntheticCycle, synthetic, defaultTariffs())
    assert.deepEqual(
      milestones.map((item) => item.thresholdM3),
      [15, 30, 60],
    )
    assert.deepEqual(
      milestones.map((item) => Math.floor(item.index + 1)),
      [4, 6, 8],
    )
    assert.ok(milestones.every((item) => item.amount > 0))
  })

  it('marks all blocks at the same point when one point crosses several', () => {
    const synthetic = [{ at: '2026-10-22T08:00:00-06:00', value: 70 }].map((item) => ({
      id: `r-${Date.parse(item.at)}-${item.value.toFixed(3)}`,
      at: item.at,
      value: item.value,
      note: '',
    }))
    const syntheticCycle = {
      id: '2026-10',
      label: '20-OCT – 20-NOV',
      startAt: '2026-10-20T00:00:00-06:00',
      endAt: '2026-11-20T00:00:00-06:00',
      baseValue: 0,
      baseReadingAt: null,
      finalReading: 70,
      finalReadingAt: '2026-10-22T08:00:00-06:00',
      readingsCount: 1,
      open: true,
    }
    const milestones = findBlockMilestones(syntheticCycle, synthetic, defaultTariffs())
    assert.deepEqual(
      milestones.map((item) => item.thresholdM3),
      [15, 30, 60],
    )
    assert.equal(new Set(milestones.map((item) => item.index)).size, 1)
  })
})
