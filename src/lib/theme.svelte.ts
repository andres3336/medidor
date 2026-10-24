export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'medidor.theme'
const media =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function stored(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'auto'
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto'
}

export const theme = $state<{ preference: ThemePreference; resolved: ResolvedTheme }>({
  preference: stored(),
  resolved: 'dark',
})

function resolve(): ResolvedTheme {
  if (theme.preference === 'auto') return media?.matches ? 'dark' : 'light'
  return theme.preference
}

function apply() {
  theme.resolved = resolve()
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme.resolved
  document.documentElement.style.colorScheme = theme.resolved
  const color = theme.resolved === 'dark' ? '#0b1220' : '#f6f8fb'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

export function setTheme(preference: ThemePreference) {
  theme.preference = preference
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, preference)
  apply()
}

export function cycleTheme() {
  setTheme(theme.resolved === 'dark' ? 'light' : 'dark')
}

export function initTheme() {
  media?.addEventListener('change', () => {
    if (theme.preference === 'auto') apply()
  })
  apply()
}
