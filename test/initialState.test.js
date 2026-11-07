import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildInitialState } from '../public/assets/domain/initialState.js'

describe('initial state', () => {
  it('starts empty: the sheet is the only source', () => {
    assert.deepEqual(buildInitialState().readings, [])
  })

  it('returns a new list on every start', () => {
    assert.notEqual(buildInitialState().readings, buildInitialState().readings)
  })
})
