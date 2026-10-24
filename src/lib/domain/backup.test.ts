import { describe, expect, it } from 'vitest'
import { normalizeAppState } from './backup'
import { buildInitialState } from './seed'

describe('backup', () => {
  it('normaliza un estado semilla completo', () => {
    const state = buildInitialState()
    const normalized = normalizeAppState(JSON.parse(JSON.stringify(state)))
    expect(normalized.readings).toHaveLength(60)
    expect(normalized.cycles.filter((cycle) => cycle.endAt === null)).toHaveLength(1)
    expect(normalized.settings.tariffs.blocks).toHaveLength(4)
  })

  it('rechaza un JSON sin ciclos', () => {
    expect(() => normalizeAppState({ schema: 1, readings: [] })).toThrow(/ciclos/i)
  })

  it('rechaza un estado sin ciclo abierto', () => {
    const state = buildInitialState()
    state.cycles = state.cycles.map((cycle) => ({
      ...cycle,
      endAt: cycle.endAt ?? '2026-11-20T00:00:00-06:00',
    }))
    expect(() => normalizeAppState(state)).toThrow(/ciclo abierto/i)
  })

  it('rechaza lecturas con fecha inválida', () => {
    const state = buildInitialState()
    state.readings[0].at = 'no-es-fecha'
    expect(() => normalizeAppState(state)).toThrow(/fecha inválida/i)
  })

  it('rellena settings faltantes con los defaults', () => {
    const state = buildInitialState()
    const minimal = {
      schema: 1,
      updatedAt: state.updatedAt,
      settings: {},
      cycles: state.cycles,
      readings: state.readings,
    }
    const normalized = normalizeAppState(minimal)
    expect(normalized.settings.cycleDay).toBe(20)
    expect(normalized.settings.tariffs.blocks).toHaveLength(4)
    expect(normalized.settings.flow.dangerLph).toBe(5)
  })
})
