import { describe, expect, it } from 'vitest'
import { buildInitialState } from './initialState'
import { normalizeAppState } from './backup'
import { SCHEMA_VERSION } from './constants'

describe('estado inicial', () => {
  it('arranca vacío: la hoja es la única fuente', () => {
    const state = buildInitialState()
    expect(state.schema).toBe(SCHEMA_VERSION)
    expect(state.readings).toEqual([])
    expect(Number.isNaN(Date.parse(state.updatedAt))).toBe(false)
  })

  it('entrega una lista nueva en cada arranque', () => {
    expect(buildInitialState().readings).not.toBe(buildInitialState().readings)
  })

  it('se puede normalizar sin mediciones', () => {
    const normalized = normalizeAppState(JSON.parse(JSON.stringify(buildInitialState())))
    expect(normalized.readings).toEqual([])
    expect(normalized.schema).toBe(SCHEMA_VERSION)
  })
})
