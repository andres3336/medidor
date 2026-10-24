import seedCsv from '../../data.csv?raw'
import type { AppState, Reading } from './types'
import { parseReadingsCsv } from './csv'
import { dedupeReadings, sortReadings } from './readings'
import { nowIso } from './dates'
import { SCHEMA_VERSION } from './constants'

/** `data.csv` viaja dentro del bundle: no hay fetch inicial ni dependencia de red. */
export const SEED_CSV = seedCsv

export function seedReadings(csv: string = SEED_CSV): Reading[] {
  return dedupeReadings(parseReadingsCsv(csv).readings)
}

export function buildInitialState(): AppState {
  return {
    schema: SCHEMA_VERSION,
    updatedAt: nowIso(),
    readings: seedReadings(),
  }
}

export type SeedReport = {
  rows: number
  readings: number
  errors: ReturnType<typeof parseReadingsCsv>['errors']
  first: string | null
  last: string | null
}

export function seedReport(csv: string = SEED_CSV): SeedReport {
  const parsed = parseReadingsCsv(csv)
  const readings = sortReadings(parsed.readings)
  return {
    rows: parsed.rows,
    readings: readings.length,
    errors: parsed.errors,
    first: readings[0]?.at ?? null,
    last: readings[readings.length - 1]?.at ?? null,
  }
}
