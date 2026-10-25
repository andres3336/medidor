import type { AppState } from './types'
import { nowIso } from './dates'
import { SCHEMA_VERSION } from './constants'

/**
 * Primer arranque: sin mediciones.
 * La hoja publicada de Google Sheets es la única fuente; IndexedDB es la caché.
 */
export function buildInitialState(): AppState {
  return {
    schema: SCHEMA_VERSION,
    updatedAt: nowIso(),
    readings: [],
  }
}
