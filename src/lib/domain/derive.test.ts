import { describe, expect, it } from 'vitest'
import { fixtureState } from './__fixtures__/mediciones'
import { deriveAnalytics } from '../state/derive'

const state = fixtureState()
const now = new Date('2026-10-24T12:00:00-06:00')
const analytics = deriveAnalytics(state, now)

describe('derivados de la app', () => {
  it('arma el ciclo actual con base del 19 oct y consumo', () => {
    expect(analytics.cycle.id).toBe('2026-10')
    expect(analytics.cycle.baseValue).toBe(100.156)
    expect(analytics.billableM3).toBe(3)
    expect(analytics.currentBill.total).toBeCloseTo(5819, 2)
    expect(analytics.currentBill.displayTotal).toBe(5819)
    expect(analytics.projection!.currentExactM3).toBeCloseTo(3.754, 3)
  })

  it('calcula outliers solo en la ventana reciente de cada ciclo', () => {
    expect(Array.isArray(analytics.anomalies)).toBe(true)
    expect(analytics.anomalies.every((anomaly) => anomaly.multiplier > 0)).toBe(true)
    expect(analytics.anomalies.some((anomaly) => anomaly.day.startsWith('2026-09-2'))).toBe(false)
  })

  it('calcula el promedio diario desde el inicio del ciclo', () => {
    expect(analytics.averageM3PerDay).toBeCloseTo(0.834, 2)
  })

  it('calcula el promedio diario del ciclo anterior', () => {
    expect(analytics.previousCycleAverageM3PerDay).toBeCloseTo(0.908, 3)
  })

  it('no inventa días faltantes cuando hay medición diaria', () => {
    expect(analytics.gaps.missingDays).toEqual([])
    expect(analytics.gaps.missingYesterday).toBe(false)
  })

  it('proyecta con el promedio de los últimos días del ciclo', () => {
    expect(analytics.projection).not.toBeNull()
    expect(analytics.projection!.rateSampleDays).toBeGreaterThan(0)
    expect(analytics.projection!.rateLitersPerDay).toBeGreaterThan(0)
    expect(analytics.projection!.projectedM3).toBeGreaterThan(analytics.projection!.currentExactM3)
    expect(analytics.projection!.projectedBillableM3).toBeGreaterThanOrEqual(
      analytics.projection!.currentBillableM3,
    )
  })

  it('marca outliers sin depender de las notas', () => {
    expect(Array.isArray(analytics.anomalies)).toBe(true)
    expect(analytics.anomalies.every((anomaly) => anomaly.multiplier > 0)).toBe(true)
  })
})
