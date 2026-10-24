import { registerSW } from 'virtual:pwa-register'
import { flushSave } from './state/store.svelte'

const isBrowser = typeof window !== 'undefined'

export const pwa = $state({
  /** Hay una versión nueva esperando: preguntar antes de recargar. */
  needRefresh: false,
  offline: false,
})

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null

export function initPwa() {
  if (!isBrowser) return

  pwa.offline = !navigator.onLine
  window.addEventListener('online', () => (pwa.offline = false))
  window.addEventListener('offline', () => (pwa.offline = true))

  if (!('serviceWorker' in navigator)) return

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      pwa.needRefresh = true
    },
    onRegisterError(error) {
      console.error('[medidor] no se pudo registrar el service worker', error)
    },
  })
}

export async function reloadForUpdate() {
  if (typeof document !== 'undefined') {
    const hasDialog = document.querySelector('dialog[open]')
    const hasDraft = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
    ).some((field) => field.value.trim() !== '')
    if (
      (hasDialog || hasDraft) &&
      !window.confirm('Hay un formulario abierto. ¿Actualizar igual?')
    ) {
      return
    }
  }
  flushSave()
  pwa.needRefresh = false
  if (applyUpdate) {
    await applyUpdate(true)
    return
  }
  window.location.reload()
}

export function dismissUpdate() {
  pwa.needRefresh = false
}
