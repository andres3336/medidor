import { describe, expect, it } from 'vitest'
import { fixtureReadings } from './__fixtures__/mediciones'
import { buildCycles, currentCycle } from './cycles'
import { buildDailySeries, makeReading } from './readings'
import { buildProjection } from './projections'
import { defaultTariffs } from './tariffs'
import {
  buildBillComparison,
  buildBillSeries,
  buildCycleSeries,
  buildDailyComparison,
  buildDailyCycle,
  findBlockMilestones,
  trafficBand,
} from './periods'
import type { Cycle } from './types'

const now = new Date('2026-10-24T12:00:00-06:00')
const readings = fixtureReadings()
const cycles = buildCycles(readings, now)
const cycle = currentCycle(cycles, now)!
const days = buildDailySeries(readings)
const projection = buildProjection({
  cycle,
  readings,
  days,
  tariffs: defaultTariffs(),
  now,
})

describe('serie diaria del ciclo', () => {
  it('incluye todos los días y proyecta desde el día siguiente a la última medición', () => {
    const daily = buildDailyCycle(cycle, days, projection, now, false)
    expect(daily[0].day).toBe('2026-10-20')
    expect(daily.at(-1)?.day).toBe('2026-11-19')
    expect(daily.find((point) => point.day === '2026-10-20')?.kind).toBe('actual')
    expect(daily.find((point) => point.day === '2026-10-24')?.kind).toBe('actual')
    expect(daily.find((point) => point.day === '2026-11-19')?.kind).toBe('projected')
  })

  it('si ya hay medición hoy, la proyección empieza mañana', () => {
    const daily = buildDailyCycle(cycle, days, projection, now, true)
    expect(daily.find((point) => point.day === '2026-10-24')?.kind).toBe('actual')
    expect(daily.find((point) => point.day === '2026-10-25')?.kind).toBe('projected')
  })

  it('numera los días del ciclo desde 1', () => {
    const daily = buildDailyCycle(cycle, days, projection, now, false)
    expect(daily[0].dayNumber).toBe(1)
    expect(daily.at(-1)?.dayNumber).toBe(daily.length)
  })

  it('aplica el semáforo 75/90 por porcentaje del máximo', () => {
    expect(trafficBand(75, 100)).toBe('green')
    expect(trafficBand(76, 100)).toBe('yellow')
    expect(trafficBand(90, 100)).toBe('yellow')
    expect(trafficBand(91, 100)).toBe('red')
    expect(trafficBand(null, 100)).toBe('green')
  })

  it('acumula un punto por día con medición', () => {
    const series = buildCycleSeries(cycle, readings, projection)
    expect(series.points).toHaveLength(6)
    expect(series.points[0].m3).toBe(0)
    expect(series.totalM3).toBeCloseTo(3.754, 3)
    expect(series.projected.length).toBeGreaterThan(1)
  })

  it('convierte la serie acumulada en factura estimada', () => {
    const bill = buildBillSeries(cycle, readings, projection, defaultTariffs())
    expect(bill.points[0].amount).toBe(3200)
    expect(bill.totalAmount).toBe(5819)
    expect(bill.points.at(-1)?.amount).toBe(5819)
    expect(bill.projected.at(-1)?.amount).toBe(projection!.projectedBill.displayTotal)
  })
})

describe('comparación de factura estimada', () => {
  it('compara el periodo actual contra el anterior', () => {
    const comparison = buildBillComparison(cycles, readings, cycle, projection, defaultTariffs())
    expect(comparison.previous?.cycle.id).toBe('2026-09')
    expect(comparison.previous?.totalAmount).toBe(37559)
    expect(comparison.current.totalAmount).toBe(5819)
  })
})

describe('comparación día a día', () => {
  it('arma 32 días y alinea día con día', () => {
    const comparison = buildDailyComparison(cycle, cycles[0], days)
    expect(comparison.maxDay).toBe(32)
    expect(comparison.days).toHaveLength(32)
    expect(comparison.days.map((point) => point.dayNumber)).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 1),
    )
    expect(comparison.days[0]).toMatchObject({
      dayNumber: 1,
      previousM3: null,
      currentM3: 0.249,
    })
    expect(comparison.days[1]).toMatchObject({
      dayNumber: 2,
      previousM3: 1.635,
      currentM3: 0.846,
    })
    expect(comparison.days[31]).toMatchObject({
      dayNumber: 32,
      previousM3: null,
      currentM3: null,
      previousAt: null,
      currentAt: null,
    })
  })

  it('deja en blanco los días sin medición y no proyecta', () => {
    const comparison = buildDailyComparison(cycle, cycles[0], days)
    expect(comparison.days[5]).toMatchObject({
      dayNumber: 6,
      previousM3: 0.487,
      currentM3: null,
    })
    expect(comparison.days[30]).toMatchObject({
      dayNumber: 31,
      previousM3: null,
      currentM3: null,
    })
    expect(comparison.days[29].currentM3).toBeNull()
  })
})

describe('hitos de bloque', () => {
  it('marca el día en que el ciclo 2026-09 alcanza el bloque 1', () => {
    const milestones = findBlockMilestones(cycles[0], readings, defaultTariffs())
    expect(milestones).toHaveLength(1)
    expect(milestones[0].block).toBe(1)
    expect(milestones[0].thresholdM3).toBe(15)
    expect(milestones[0].billableM3).toBe(15)
    expect(milestones[0].m3).toBeCloseTo(15.028, 3)
    expect(milestones[0].amount).toBe(16295)
    expect(Math.floor(milestones[0].index + 1)).toBe(16)
  })

  it('no inventa hitos si el ciclo no llega a un bloque', () => {
    expect(findBlockMilestones(cycles[1], readings, defaultTariffs())).toEqual([])
  })

  it('marca cada bloque nuevo en su propio punto', () => {
    const synthetic = [
      makeReading({ at: '2026-10-21T08:00:00-06:00', value: 10 }),
      makeReading({ at: '2026-10-23T08:00:00-06:00', value: 16 }),
      makeReading({ at: '2026-10-25T08:00:00-06:00', value: 32 }),
      makeReading({ at: '2026-10-27T08:00:00-06:00', value: 61 }),
    ]
    const syntheticCycle: Cycle = {
      id: '2026-10',
      label: '20 oct – 20 nov',
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
    expect(milestones.map((item) => item.thresholdM3)).toEqual([15, 30, 60])
    expect(milestones.map((item) => Math.floor(item.index + 1))).toEqual([4, 6, 8])
    expect(milestones.every((item) => item.amount > 0)).toBe(true)
  })

  it('si un punto cruza varios bloques, los marca todos ahí', () => {
    const synthetic = [makeReading({ at: '2026-10-22T08:00:00-06:00', value: 70 })]
    const syntheticCycle: Cycle = {
      id: '2026-10',
      label: '20 oct – 20 nov',
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
    expect(milestones.map((item) => item.thresholdM3)).toEqual([15, 30, 60])
    expect(new Set(milestones.map((item) => item.index)).size).toBe(1)
  })
})
