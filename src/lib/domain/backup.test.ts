import { describe, expect, it } from 'vitest'
import { normalizeAppState } from './backup'
import { buildInitialState } from './seed'
import { SCHEMA_VERSION } from './constants'

describe('backup y migración', () => {
  it('normaliza un estado semilla completo', () => {
    const state = buildInitialState()
    const normalized = normalizeAppState(JSON.parse(JSON.stringify(state)))
    expect(normalized.schema).toBe(SCHEMA_VERSION)
    expect(normalized.readings).toHaveLength(66)
  })

  it('rechaza un JSON sin mediciones', () => {
    expect(() => normalizeAppState({ schema: 2 })).toThrow(/mediciones/i)
  })

  it('rechaza lecturas con fecha inválida', () => {
    const state = buildInitialState()
    state.readings[0].at = 'no-es-fecha'
    expect(() => normalizeAppState(state)).toThrow(/fecha inválida/i)
  })

  it('migra un estado viejo con ciclos y settings: solo conserva mediciones', () => {
    const state = buildInitialState()
    const old = {
      schema: 1,
      updatedAt: state.updatedAt,
      settings: { cycleDay: 20, tariffs: { blocks: [] }, gist: { id: 'x' } },
      cycles: [
        { id: '2026-09', baseValue: 73 },
        { id: '2026-10', baseValue: 100.283 },
      ],
      readings: state.readings,
    }
    const normalized = normalizeAppState(old)
    expect(normalized.schema).toBe(SCHEMA_VERSION)
    expect(normalized.readings).toHaveLength(66)
    expect('cycles' in normalized).toBe(false)
    expect('settings' in normalized).toBe(false)
  })

  it('rechaza versiones de schema desconocidas', () => {
    expect(() => normalizeAppState({ schema: 99, readings: [] })).toThrow(/versión/i)
  })
})
