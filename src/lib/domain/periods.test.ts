import { describe, expect, it } from 'vitest'
import { seedReadings } from './seed'
import { buildCycles, currentCycle } from './cycles'
import { buildDailySeries } from './readings'
import { buildProjection } from './projections'
import { defaultTariffs } from './tariffs'
import {
  buildBillComparison,
  buildBillSeries,
  buildCycleSeries,
  buildDailyCycle,
  trafficBand,
} from './periods'

const now = new Date('2026-10-24T12:00:00-06:00')
const readings = seedReadings()
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
