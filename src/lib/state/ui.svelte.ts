const KEY = 'medidor.installBannerDismissed'

function read(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(KEY) === '1'
}

export const installBannerDismissed = $state({ value: read() })

export function dismissInstallBanner() {
  installBannerDismissed.value = true
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, '1')
}

export function resetInstallBanner() {
  installBannerDismissed.value = false
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
}
