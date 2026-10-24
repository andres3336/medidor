import type { AppState, Reading } from '../domain/types'
import { buildInitialState } from '../domain/seed'
import { serializeReadingsCsv } from '../domain/csv'
import { sortReadings } from '../domain/readings'
import { nowIso } from '../domain/dates'
import { normalizeAppState } from '../domain/backup'
import { loadAppState, requestPersistence, saveAppState } from './idb'

export const app = $state({
  state: buildInitialState() as AppState,
  ready: false,
  error: null as string | null,
  dirty: false,
  lastSavedAt: null as string | null,
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
      } catch {
        app.state = buildInitialState()
      }
    }
    if (!loaded) app.state = buildInitialState()
    // El token del gist quedó obsoleto y no debe vivir en el dispositivo.
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('medidor.gist.token')
      localStorage.removeItem('medidor.installBannerDismissed')
    }
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

export function exportCsv(): string {
  return serializeReadingsCsv(app.state.readings)
}

export function flushSave() {
  if (pendingSave) persistNow()
}
