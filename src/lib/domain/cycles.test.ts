import { describe, expect, it } from 'vitest'
import {
  adjustCycle,
  closeCycle,
  currentCycle,
  cycleDayProgress,
  cycleReadings,
  expectedCycleEnd,
  findCycleFor,
  isCloseDue,
} from './cycles'
import { seedCycles } from './settings'
import { seedReadings } from './seed'
import { dayKey } from './dates'

describe('ciclos', () => {
  it('encuentra el ciclo por fecha con borde exclusivo', () => {
    const cycles = seedCycles()
    expect(findCycleFor(cycles, '2026-10-20T09:00:00-06:00')?.id).toBe('2026-09')
    expect(findCycleFor(cycles, '2026-10-20T10:05:00-06:00')?.id).toBe('2026-10')
    expect(currentCycle(cycles)?.id).toBe('2026-10')
  })

  it('calcula el cierre esperado el día 20', () => {
    const cycle = currentCycle(seedCycles())!
    expect(dayKey(expectedCycleEnd(cycle, 20))).toBe('2026-11-20')
    expect(isCloseDue(cycle, 20, new Date('2026-11-19T12:00:00-06:00'))).toBe(false)
    expect(isCloseDue(cycle, 20, new Date('2026-11-20T00:30:00-06:00'))).toBe(true)
  })

  it('separa las lecturas de cada ciclo', () => {
    const readings = seedReadings()
    const cycles = seedCycles()
    const previous = cycles[0]
    const active = cycles[1]
    expect(cycleReadings(readings, previous)).toHaveLength(55)
    expect(cycleReadings(readings, active)).toHaveLength(5)
    expect(cycleReadings(readings, active)[0].value).toBe(100.283)
  })

  it('cierra el ciclo con ajuste de lectura final y auditoría', () => {
    const cycles = seedCycles()
    const result = closeCycle(cycles, {
      cycleId: '2026-10',
      cutAt: '2026-11-21T15:30:00-06:00',
      finalReading: 120.456,
      billedM3: 21,
      lastReading: 120.5,
      proposedCutAt: '2026-11-20T00:00:00-06:00',
      note: 'AYA cortó un día después',
      now: '2026-11-21T16:00:00-06:00',
    })

    expect(result.closed.endAt).toBe('2026-11-21T15:30:00-06:00')
    expect(result.closed.finalReading).toBe(120.456)
    expect(result.closed.billedM3).toBe(21)
    expect(result.closed.adjustments.map((item) => item.field)).toEqual([
      'finalReading',
      'billedM3',
      'startAt',
    ])
    expect(result.next.baseValue).toBe(120.456)
    expect(result.next.startAt).toBe('2026-11-21T15:30:00-06:00')
    expect(result.next.endAt).toBeNull()
    expect(result.cycles.filter((cycle) => cycle.endAt === null)).toHaveLength(1)
  })

  it('usa floor(lectura) - floor(base) si no se ajusta el consumo', () => {
    const result = closeCycle(seedCycles(), {
      cycleId: '2026-10',
      cutAt: '2026-11-20T00:00:00-06:00',
      finalReading: 120.456,
    })
    expect(result.closed.billedM3).toBe(20)
    expect(result.closed.adjustments).toHaveLength(0)
  })

  it('genera un id único al cerrar antes del mes siguiente', () => {
    const result = closeCycle(seedCycles(), {
      cycleId: '2026-10',
      cutAt: '2026-10-25T12:00:00-06:00',
      finalReading: 110.5,
      lastReading: 110.5,
      lastReadingAt: '2026-10-25T11:00:00-06:00',
    })
    const ids = result.cycles.map((cycle) => cycle.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.next.id).not.toBe('2026-10')
    expect(currentCycle(result.cycles)?.id).toBe(result.next.id)
  })

  it('rechaza lecturas finales, cortes o consumos inválidos', () => {
    const base = {
      cycleId: '2026-10',
      cutAt: '2026-11-20T00:00:00-06:00',
      finalReading: 110.5,
    }
    expect(() => closeCycle(seedCycles(), { ...base, finalReading: 99 })).toThrow(
      /menor que la base/i,
    )
    expect(() => closeCycle(seedCycles(), { ...base, cutAt: '2026-10-01T00:00:00-06:00' })).toThrow(
      /posterior al inicio/i,
    )
    expect(() =>
      closeCycle(seedCycles(), {
        ...base,
        lastReadingAt: '2026-11-21T00:00:00-06:00',
      }),
    ).toThrow(/última lectura/i)
    expect(() => closeCycle(seedCycles(), { ...base, billedM3: 20.5 })).toThrow(/entero/i)
  })

  it('calcula el cierre del mes siguiente aunque el inicio esté a fin de mes', () => {
    const cycle = {
      ...currentCycle(seedCycles())!,
      startAt: '2026-10-31T20:00:00-06:00',
    }
    expect(dayKey(expectedCycleEnd(cycle, 20))).toBe('2026-11-20')
  })

  it('audita el ajuste manual de la base', () => {
    const cycle = currentCycle(seedCycles())!
    const adjusted = adjustCycle(
      cycle,
      { baseValue: 100.5, reason: 'AYA ajustó la lectura' },
      '2026-10-24T10:00:00-06:00',
    )
    expect(adjusted.baseValue).toBe(100.5)
    expect(adjusted.adjustments[0]).toMatchObject({
      field: 'baseValue',
      oldValue: 100.283,
      newValue: 100.5,
      reason: 'AYA ajustó la lectura',
    })
  })

  it('calcula progreso del ciclo', () => {
    const cycle = currentCycle(seedCycles())!
    const progress = cycleDayProgress(cycle, 20, new Date('2026-10-25T10:05:00-06:00'))
    expect(progress.elapsedDays).toBeCloseTo(5, 1)
    expect(progress.remainingDays).toBeCloseTo(26, 0)
  })
})
