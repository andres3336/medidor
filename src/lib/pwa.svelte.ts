import { registerSW } from 'virtual:pwa-register'
import { flushSave } from './state/store.svelte'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const isBrowser = typeof window !== 'undefined'

function standalone(): boolean {
  if (!isBrowser) return false
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

export const pwa = $state({
  /** Hay una versión nueva esperando: preguntar antes de recargar. */
  needRefresh: false,
  /** El shell ya quedó disponible offline (primer install del SW). */
  offlineReady: false,
  /** El navegador disparó beforeinstallprompt y podemos mostrar el botón. */
  canInstall: false,
  installed: standalone(),
  /** iOS no soporta beforeinstallprompt: hay que explicar el flujo manual. */
  isIos: false,
  isSafari: false,
  swRegistered: false,
  offline: false,
})

let deferredPrompt: BeforeInstallPromptEvent | null = null
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null

export function initPwa() {
  if (!isBrowser) return

  pwa.isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  pwa.isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
  pwa.offline = !navigator.onLine

  window.addEventListener('online', () => (pwa.offline = false))
  window.addEventListener('offline', () => (pwa.offline = true))
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    pwa.canInstall = !pwa.installed
  })
  window.addEventListener('appinstalled', () => {
    pwa.canInstall = false
    pwa.installed = true
    deferredPrompt = null
  })

  if (!('serviceWorker' in navigator)) return

  applyUpdate = registerSW({
    immediate: true,
    onRegisteredSW() {
      pwa.swRegistered = true
    },
    onNeedRefresh() {
      pwa.needRefresh = true
    },
    onOfflineReady() {
      pwa.offlineReady = true
    },
    onRegisterError(error) {
      console.error('[medidor] no se pudo registrar el service worker', error)
    },
  })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  pwa.canInstall = false
  return outcome
}

export async function reloadForUpdate() {
  if (
    typeof document !== 'undefined' &&
    document.querySelector('[role="dialog"], [role="alertdialog"]') &&
    !window.confirm(
      'Hay un formulario abierto. ¿Actualizar igual? Se guarda lo que ya está registrado.',
    )
  ) {
    return
  }
  flushSave()
  pwa.needRefresh = false
  if (applyUpdate) {
    await applyUpdate(true)
    return
  }
  // Fallback: una recarga normal mantiene los datos en IndexedDB.
  window.location.reload()
}

export function dismissUpdate() {
  pwa.needRefresh = false
}
