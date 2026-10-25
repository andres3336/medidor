import { describe, expect, it } from 'vitest'
import { normalizeAppState } from './backup'
import { fixtureState } from './__fixtures__/mediciones'
import { SCHEMA_VERSION } from './constants'

describe('backup y migración', () => {
  it('normaliza un estado con mediciones', () => {
    const state = fixtureState()
    const normalized = normalizeAppState(JSON.parse(JSON.stringify(state)))
    expect(normalized.schema).toBe(SCHEMA_VERSION)
    expect(normalized.readings).toHaveLength(66)
  })

  it('rechaza un JSON sin mediciones', () => {
    expect(() => normalizeAppState({ schema: 2 })).toThrow(/mediciones/i)
  })

  it('rechaza lecturas con fecha inválida', () => {
    const state = fixtureState()
    state.readings[0].at = 'no-es-fecha'
    expect(() => normalizeAppState(state)).toThrow(/fecha inválida/i)
  })

  it('migra un estado viejo con ciclos y settings: solo conserva mediciones', () => {
    const state = fixtureState()
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

  it('mapea la fuente vieja data.csv a la hoja', () => {
    const normalized = normalizeAppState({
      schema: 2,
      readings: [
        {
          id: 'r-1',
          at: '2026-10-23T09:20:00-06:00',
          value: 103.077,
          note: 'vieja',
          source: 'data.csv',
        },
        {
          id: 'r-2',
          at: '2026-10-24T09:07:00-06:00',
          value: 103.91,
          note: 'favorita',
          source: 'app',
        },
      ],
    })
    expect(normalized.readings.map((reading) => reading.source)).toEqual(['sheet', 'app'])
  })
})
