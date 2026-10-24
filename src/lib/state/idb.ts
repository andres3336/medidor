import type { AppState } from '../domain/types'

const DB_NAME = 'medidor'
const DB_VERSION = 1
const STORE = 'state'
const KEY = 'app'
const FALLBACK_KEY = 'medidor.state.fallback'

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'))
  })
}

function readFallback(): AppState | null {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY)
    return raw ? (JSON.parse(raw) as AppState) : null
  } catch {
    return null
  }
}

export async function loadAppState(): Promise<AppState | null> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb()
      const stored = await new Promise<AppState | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const request = tx.objectStore(STORE).get(KEY)
        request.onsuccess = () => resolve((request.result as AppState | undefined) ?? null)
        request.onerror = () => reject(request.error)
      })
      db.close()
      if (stored) return stored
    } catch (error) {
      console.warn('[medidor] IndexedDB no disponible, uso localStorage', error)
    }
  }
  return readFallback()
}

export async function saveAppState(state: AppState): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(state)) as AppState
  if (hasIndexedDb()) {
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(snapshot, KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
      return
    } catch (error) {
      console.warn('[medidor] fallo al guardar en IndexedDB', error)
    }
  }
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshot))
}

export async function clearAppState(): Promise<void> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    } catch (error) {
      console.warn('[medidor] fallo al borrar IndexedDB', error)
    }
  }
  localStorage.removeItem(FALLBACK_KEY)
}

/** Pide al navegador que no borre los datos por presión de espacio. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
