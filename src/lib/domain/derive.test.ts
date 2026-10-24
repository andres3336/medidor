import { describe, expect, it } from 'vitest'
import { buildInitialState } from './seed'
import { deriveAnalytics, whatIf } from '../state/derive'

const state = buildInitialState()
const now = new Date('2026-10-24T12:00:00-06:00')
const analytics = deriveAnalytics(state, now)

describe('derivados de la app', () => {
  it('arma el ciclo actual, consumo y factura a hoy', () => {
    expect(analytics.cycle.id).toBe('2026-10')
    expect(analytics.billableM3).toBe(3)
    expect(analytics.currentBill.total).toBeCloseTo(5819, 2)
    expect(analytics.currentBill.displayTotal).toBe(5819)
  })

  it('calcula la base normal con los 14 días recientes', () => {
    expect(analytics.baseline.sampleSize).toBeGreaterThanOrEqual(5)
    expect(analytics.baseline.sufficient).toBe(true)
    expect(analytics.baseline.median).toBeGreaterThan(0)
    expect(analytics.baseline.p25).toBeLessThanOrEqual(analytics.baseline.median)
    expect(analytics.baseline.p75).toBeGreaterThanOrEqual(analytics.baseline.median)
  })

  it('no inventa días faltantes cuando hay lectura diaria', () => {
    expect(analytics.gaps.missingDays).toEqual([])
    expect(analytics.gaps.unacknowledged).toEqual([])
  })

  it('mantiene la factura del ciclo cerrado en ₡37,559', () => {
    const previous = analytics.history.find((row) => row.cycle.id === '2026-09')
    expect(previous?.billableM3).toBe(27)
    expect(previous?.bill?.total).toBeCloseTo(37559, 2)
  })

  it('genera conclusiones y un peor escenario propio del ciclo', () => {
    expect(analytics.conclusions.length).toBeGreaterThan(0)
    expect(analytics.projection).not.toBeNull()
    const cycleMax = Math.max(...analytics.cycleDays.map((day) => day.litersPerDay))
    expect(analytics.projection!.worst.rateLitersPerDay).toBeCloseTo(cycleMax, 1)
    expect(analytics.projection!.worst.billableM3).toBeLessThan(60)
  })

  it('el what-if sube la factura al aumentar el consumo', () => {
    const base = whatIf(analytics, state, 0)
    const more = whatIf(analytics, state, 500)
    expect(more.bill.total).toBeGreaterThanOrEqual(base.bill.total)
  })
})
