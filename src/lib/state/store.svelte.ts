import type { AppState, Cycle, Reading, Settings } from '../domain/types'
import { buildInitialState } from '../domain/seed'
import { parseReadingsCsv, serializeReadingsCsv } from '../domain/csv'
import { dedupeReadings, makeReading, sortReadings } from '../domain/readings'
import { nowIso } from '../domain/dates'
import { adjustCycle, closeCycle, type CloseCycleInput } from '../domain/cycles'
import { normalizeAppState } from '../domain/backup'
import { setTheme, theme } from '../theme.svelte'
import { clearAppState, loadAppState, requestPersistence, saveAppState } from './idb'

export const app = $state({
  state: buildInitialState() as AppState,
  ready: false,
  error: null as string | null,
  dirty: false,
  lastSavedAt: null as string | null,
  seedWarning: null as string | null,
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = false

function persistNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  pendingSave = false
  const snapshot = $state.snapshot(app.state) as AppState
  app.dirty = false
  void saveAppState(snapshot)
    .then(() => {
      app.lastSavedAt = nowIso()
    })
    .catch((error: unknown) => {
      app.error = error instanceof Error ? error.message : 'No se pudo guardar'
      app.dirty = true
    })
}

function queueSave(delay = 400) {
  app.dirty = true
  pendingSave = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNow, delay)
}

export function touchState() {
  app.state.updatedAt = nowIso()
  queueSave()
}

export async function initStore() {
  try {
    const loaded = await loadAppState()
    if (loaded) {
      try {
        app.state = normalizeAppState(loaded)
        app.seedWarning = null
      } catch {
        app.seedWarning = 'El estado guardado estaba dañado; se cargó el CSV inicial'
      }
    }
    if (!loaded || app.seedWarning) {
      app.state = buildInitialState()
      app.seedWarning ??= `${app.state.readings.length} lecturas cargadas desde data.csv`
    }
    setTheme(app.state.settings.theme === 'auto' ? 'auto' : app.state.settings.theme)
    app.ready = true
    void requestPersistence()
  } catch (error) {
    app.error = error instanceof Error ? error.message : 'No se pudo cargar el estado'
    app.ready = true
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (pendingSave) persistNow()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && pendingSave) persistNow()
    })
  }
}

export function addReading(input: {
  at: string
  value: number
  note?: string
  tags?: string[]
  flag?: boolean
}): Reading {
  const reading = makeReading({ ...input, source: 'app' })
  const duplicate = app.state.readings.find(
    (item) => !item.deleted && item.at === reading.at && item.value === reading.value,
  )
  if (duplicate) {
    app.state.readings = app.state.readings.map((item) =>
      item.id === duplicate.id
        ? {
            ...item,
            note: reading.note || item.note,
            tags: [...new Set([...item.tags, ...reading.tags])],
            flag: item.flag || reading.flag,
            updatedAt: nowIso(),
          }
        : item,
    )
  } else {
    app.state.readings.push(reading)
  }
  app.state.readings = sortReadings(app.state.readings)
  touchState()
  return reading
}

export function updateReading(
  id: string,
  patch: Partial<Pick<Reading, 'at' | 'value' | 'note' | 'tags' | 'flag'>>,
) {
  app.state.readings = app.state.readings.map((reading) =>
    reading.id === id ? { ...reading, ...patch, updatedAt: nowIso() } : reading,
  )
  app.state.readings = sortReadings(app.state.readings)
  touchState()
}

export function toggleFlag(id: string) {
  const reading = app.state.readings.find((item) => item.id === id)
  if (!reading) return
  updateReading(id, { flag: !reading.flag })
}

export function deleteReading(id: string) {
  app.state.readings = app.state.readings.map((reading) =>
    reading.id === id ? { ...reading, deleted: true, updatedAt: nowIso() } : reading,
  )
  touchState()
}

export function restoreReading(id: string) {
  app.state.readings = app.state.readings.map((reading) =>
    reading.id === id ? { ...reading, deleted: false, updatedAt: nowIso() } : reading,
  )
  touchState()
}

export function replaceState(next: AppState) {
  app.state = next
  setTheme(next.settings.theme === 'auto' ? 'auto' : next.settings.theme)
  touchState()
}

export function updateSettings(patch: Partial<Settings>) {
  app.state.settings = { ...app.state.settings, ...patch }
  if (patch.theme) setTheme(patch.theme)
  touchState()
}

/** Alterna claro/oscuro y lo persiste también en el estado (backup/gist). */
export function toggleTheme() {
  updateSettings({ theme: theme.resolved === 'dark' ? 'light' : 'dark' })
}

export function replaceCycles(cycles: Cycle[]) {
  app.state.cycles = cycles
  touchState()
}

export function saveCycle(cycle: Cycle) {
  app.state.cycles = app.state.cycles.map((item) => (item.id === cycle.id ? cycle : item))
  touchState()
}

export function updateCycleBase(cycle: Cycle, baseValue: number, reason: string) {
  saveCycle(adjustCycle(cycle, { baseValue, reason }))
}

export function closeCurrentCycle(input: CloseCycleInput) {
  const result = closeCycle(app.state.cycles, {
    ...input,
    cycleDay: input.cycleDay ?? app.state.settings.cycleDay,
  })
  app.state.cycles = result.cycles
  touchState()
  return result
}

export function acknowledgeGaps(days: string[]) {
  app.state.settings = {
    ...app.state.settings,
    acknowledgedGaps: [...new Set([...app.state.settings.acknowledgedGaps, ...days])],
  }
  touchState()
}

export function exportCsv(): string {
  return serializeReadingsCsv(app.state.readings)
}

export function exportJson(): string {
  return JSON.stringify($state.snapshot(app.state), null, 2)
}

export type ImportResult = {
  imported: number
  duplicated: number
  errors: string[]
}

export function importCsvText(text: string): ImportResult {
  const parsed = parseReadingsCsv(text)
  const existing = app.state.readings
  const merged = dedupeReadings([...existing, ...parsed.readings])
  const imported = merged.length - existing.length
  app.state.readings = merged
  touchState()
  return {
    imported: Math.max(0, imported),
    duplicated: parsed.readings.length - Math.max(0, imported),
    errors: parsed.errors.map((error) => `Línea ${error.line}: ${error.message}`),
  }
}

export function importJsonText(text: string): ImportResult {
  try {
    const parsed: unknown = JSON.parse(text)
    const state = normalizeAppState(parsed)
    app.state = state
    touchState()
    return { imported: state.readings.length, duplicated: 0, errors: [] }
  } catch (error) {
    return {
      imported: 0,
      duplicated: 0,
      errors: [error instanceof Error ? error.message : 'JSON inválido'],
    }
  }
}

export async function resetAll() {
  await clearAppState()
  app.state = buildInitialState()
  app.lastSavedAt = null
  queueSave(0)
}

export function flushSave() {
  if (pendingSave) persistNow()
}
