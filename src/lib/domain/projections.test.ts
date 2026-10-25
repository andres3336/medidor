import { describe, expect, it } from 'vitest'
import { buildProjection } from './projections'
import { buildDailySeries, makeReading } from './readings'
import { fixtureReadings } from './__fixtures__/mediciones'
import { defaultTariffs } from './tariffs'
import { buildCycles, currentCycle } from './cycles'
import type { Cycle } from './types'

const now = new Date('2026-10-24T12:00:00-06:00')
const readings = fixtureReadings()
const cycle = currentCycle(buildCycles(readings, now), now)!
const days = buildDailySeries(readings)
const tariffs = defaultTariffs()
const projection = buildProjection({ cycle, readings, days, tariffs, now })

describe('proyección al cierre', () => {
  it('calcula consumo actual y una sola proyección', () => {
    expect(projection).not.toBeNull()
    expect(projection!.currentExactM3).toBeCloseTo(3.754, 3)
    expect(projection!.currentBillableM3).toBe(3)
    expect(projection!.currentBill.total).toBeCloseTo(5819, 2)
    expect(projection!.projectedM3).toBeGreaterThan(projection!.currentExactM3)
    expect(projection!.rateSampleDays).toBeGreaterThan(0)
  })

  it('devuelve null si el ciclo no tiene base', () => {
    const noBase: Cycle = { ...cycle, baseValue: null, baseReadingAt: null }
    expect(buildProjection({ cycle: noBase, readings, days, tariffs, now })).toBeNull()
  })

  it('detecta el cruce de IVA cuando el ritmo lo supera', () => {
    const synthetic = Array.from({ length: 5 }, (_, index) =>
      makeReading({
        at: `2026-10-${String(20 + index).padStart(2, '0')}T08:00:00-06:00`,
        value: index * 2,
      }),
    )
    const syntheticDays = buildDailySeries(synthetic)
    const bigCycle: Cycle = {
      id: '2026-10',
      label: '20 oct – 20 nov',
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
    expect(result).not.toBeNull()
    expect(result!.projectedBill.crossesIvaThreshold).toBe(true)
  })
})
