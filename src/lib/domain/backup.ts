import type { AppState, Reading } from './types'
import { nowIso } from './dates'
import { SCHEMA_VERSION } from './constants'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeReading(value: unknown, index: number): Reading {
  if (!isRecord(value)) throw new Error(`Lectura ${index + 1} inválida`)
  const at = str(value.at)
  if (!at || Number.isNaN(Date.parse(at))) throw new Error(`Lectura ${index + 1}: fecha inválida`)
  const readingValue = num(value.value, Number.NaN)
  if (!Number.isFinite(readingValue) || readingValue < 0) {
    throw new Error(`Lectura ${index + 1}: medición inválida`)
  }
  return {
    id: str(value.id) || `r-${Date.parse(at)}-${readingValue.toFixed(3)}`,
    at,
    value: readingValue,
    note: str(value.note),
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    flag: value.flag === true,
    source: value.source === 'data.csv' || value.source === 'app' ? value.source : undefined,
    createdAt: str(value.createdAt, nowIso()),
    updatedAt: str(value.updatedAt, nowIso()),
    deleted: value.deleted === true,
  }
}

/**
 * Valida y normaliza el estado guardado o un backup.
 * Schema 2 guarda solo mediciones: ciclos, tarifas y tema son derivados o constantes.
 */
export function normalizeAppState(value: unknown): AppState {
  if (!isRecord(value)) throw new Error('El archivo no contiene un estado válido')
  if (value.schema !== 1 && value.schema !== SCHEMA_VERSION) {
    throw new Error('Versión de backup no soportada')
  }
  if (!Array.isArray(value.readings)) throw new Error('Falta la lista de mediciones')

  return {
    schema: SCHEMA_VERSION,
    updatedAt: str(value.updatedAt, nowIso()),
    readings: value.readings.map(normalizeReading),
  }
}
