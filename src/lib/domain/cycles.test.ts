import { describe, expect, it } from 'vitest'
import {
  buildCycles,
  currentCycle,
  cycleDayProgress,
  cycleLabelFor,
  cycleReadings,
  nextPeriodStart,
  periodStartFor,
} from './cycles'
import { seedReadings } from './seed'
import { dayKey } from './dates'
import type { Reading } from './types'

const readings = seedReadings()
const now = new Date('2026-10-24T12:00:00-06:00')

describe('ciclos 20 → 20', () => {
  it('ubica el inicio del ciclo antes y después del día 20', () => {
    expect(dayKey(periodStartFor('2026-10-24T12:00:00-06:00'))).toBe('2026-10-20')
    expect(dayKey(periodStartFor('2026-10-19T23:59:00-06:00'))).toBe('2026-09-20')
    expect(dayKey(periodStartFor('2026-10-20T00:00:00-06:00'))).toBe('2026-10-20')
  })

  it('calcula el siguiente corte y la etiqueta', () => {
    expect(dayKey(nextPeriodStart('2026-12-20T00:00:00-06:00'))).toBe('2027-01-20')
    expect(cycleLabelFor('2026-10-20T00:00:00-06:00')).toBe('20-OCT – 20-NOV')
  })

  it('usa la última medición anterior al 20 como base del ciclo', () => {
    const cycles = buildCycles(readings, now)
    expect(cycles.map((cycle) => cycle.id)).toEqual(['2026-09', '2026-10'])

    const previous = cycles[0]
    expect(previous.baseValue).toBe(73)
    expect(previous.finalReading).toBe(100.156)
    expect(previous.open).toBe(false)

    const current = cycles[1]
    expect(current.baseValue).toBe(100.156)
    expect(current.baseReadingAt).toBe('2026-10-19T21:50:00-06:00')
    expect(current.finalReading).toBe(103.91)
    expect(current.open).toBe(true)
    expect(currentCycle(cycles, now)?.id).toBe('2026-10')
  })

  it('separa las mediciones de cada ciclo', () => {
    const cycles = buildCycles(readings, now)
    expect(cycleReadings(readings, cycles[0])).toHaveLength(58)
    expect(cycleReadings(readings, cycles[1])).toHaveLength(8)
    expect(cycleReadings(readings, cycles[1])[0].value).toBe(100.283)
  })

  it('trata el 20 a las 00:00 como parte del ciclo nuevo', () => {
    const cycles = buildCycles(readings, now)
    expect(cycleReadings(readings, cycles[1])[0].at).toBe('2026-10-20T09:00:00-06:00')
  })

  it('si edito la última medición del 19, cambia la base', () => {
    const edited: Reading[] = readings.map((reading) =>
      reading.at === '2026-10-19T21:50:00-06:00' ? { ...reading, value: 100.2 } : reading,
    )
    const cycles = buildCycles(edited, now)
    expect(cycles[1].baseValue).toBe(100.2)
  })

  it('si no hay mediciones, devuelve un ciclo sin base', () => {
    const cycles = buildCycles([], now)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].id).toBe('2026-10')
    expect(cycles[0].baseValue).toBeNull()
  })

  it('calcula progreso del ciclo', () => {
    const cycle = currentCycle(buildCycles(readings, now), now)!
    const progress = cycleDayProgress(cycle, new Date('2026-10-25T00:00:00-06:00'))
    expect(progress.elapsedDays).toBeCloseTo(5, 1)
    expect(progress.remainingDays).toBeCloseTo(26, 0)
  })
})
