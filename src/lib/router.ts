/**
 * Navegación por hash: funciona en GitHub Pages (base './') sin rewrites del servidor.
 * Hash routing es requisito del proyecto: `#/hoy`, `#/lecturas`, ...
 */

export const ROUTES = [
  { id: 'hoy', label: 'Hoy', icon: 'radar' },
  { id: 'lecturas', label: 'Lecturas', icon: 'list' },
  { id: 'graficas', label: 'Gráficas', icon: 'chart' },
  { id: 'analisis', label: 'Análisis', icon: 'search' },
  { id: 'ajustes', label: 'Ajustes', icon: 'settings' },
  { id: 'instrucciones', label: 'Instrucciones', icon: 'book' },
] as const

export type RouteId = (typeof ROUTES)[number]['id']

export const NAV_ROUTES = ROUTES.filter((r) => r.id !== 'instrucciones')

export const DEFAULT_ROUTE: RouteId = 'hoy'

export function isRouteId(value: string): value is RouteId {
  return ROUTES.some((r) => r.id === value)
}

export type ParsedHash = {
  route: RouteId
  query: URLSearchParams
}

export function parseHash(hash: string): ParsedHash {
  const raw = hash.replace(/^#\/?/, '')
  const [path, search = ''] = raw.split('?')
  const route = isRouteId(path) ? path : DEFAULT_ROUTE
  return { route, query: new URLSearchParams(search) }
}

export function routeHref(route: RouteId, query?: Record<string, string>): string {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
  return `#/${route}${qs}`
}
