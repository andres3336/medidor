import { app, touchState } from './store.svelte'
import { parseReadingsCsv } from '../domain/csv'
import { mergeSheetReadings } from '../domain/readings'
import { nowIso } from '../domain/dates'
import { showToast } from './toast.svelte'

/** Hoja publicada como CSV. Es de solo lectura: la app no escribe la hoja. */
export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHQWU9OZ7oAiJbgZ0ZZPGHOz52CAPbeVlf5h4pPyZzA3QSvFvMIHF6xti43Tw9H4SoPJ0O5T-s-2G5/pub?gid=1567341090&single=true&output=csv'

export type SheetSyncStatus = 'idle' | 'syncing' | 'ok' | 'offline' | 'error'

/**
 * La hoja publicada se cachea en el CDN de Google varios minutos.
 * `cache: 'no-store'` no alcanza; un parámetro nuevo por intento fuerza la lectura fresca.
 */
function freshSheetUrl(): string {
  const url = new URL(SHEET_CSV_URL)
  url.searchParams.set('t', String(Date.now()))
  return url.toString()
}

export const sheetSync = $state<{
  status: SheetSyncStatus
  added: number
  updated: number
  localOnly: number
  remoteCount: number
  lastAt: string | null
  error: string | null
}>({
  status: 'idle',
  added: 0,
  updated: 0,
  localOnly: 0,
  remoteCount: 0,
  lastAt: null,
  error: null,
})

let inFlight = false
let listenersReady = false

export async function syncSheetCsv(manual = false): Promise<void> {
  if (inFlight) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    sheetSync.status = 'offline'
    if (manual) showToast('Sin conexión: no se pudo sincronizar', 3600, 'error')
    return
  }

  inFlight = true
  sheetSync.status = 'syncing'
  sheetSync.error = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(freshSheetUrl(), {
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}`)
    const csv = await response.text()
    const parsed = parseReadingsCsv(csv)
    if (parsed.readings.length === 0) throw new Error('La hoja no tiene lecturas')

    const merged = mergeSheetReadings(app.state.readings, parsed.readings)
    if (merged.added > 0 || merged.updated > 0) {
      app.state.readings = merged.readings
      touchState()
    }

    sheetSync.status = 'ok'
    sheetSync.added = merged.added
    sheetSync.updated = merged.updated
    sheetSync.localOnly = merged.localOnly
    sheetSync.remoteCount = parsed.readings.length
    sheetSync.lastAt = nowIso()

    if (merged.added + merged.updated > 0) {
      showToast(`Google Sheets: ${merged.added} nuevas · ${merged.updated} actualizadas`)
    } else if (manual) {
      showToast('Hoja al día')
    }
  } catch (error) {
    const offlineNow = typeof navigator !== 'undefined' && !navigator.onLine
    sheetSync.status = offlineNow ? 'offline' : 'error'
    const message = error instanceof Error ? error.message : ''
    sheetSync.error = offlineNow
      ? 'Sin conexión: se usa la copia local'
      : /fetch|network/i.test(message)
        ? 'No se pudo conectar con Google Sheets'
        : message || 'No se pudo leer la hoja'
    if (manual) showToast(sheetSync.error, 4200, 'error')
  } finally {
    inFlight = false
  }
}

export function initSheetSync(): void {
  if (typeof window === 'undefined' || listenersReady) return
  listenersReady = true

  window.addEventListener('online', () => {
    void syncSheetCsv()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncSheetCsv()
  })
}
