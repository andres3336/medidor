import { DEFAULT_ROUTE, parseHash, type RouteId } from './router'

/** Estado reactivo de la ruta actual. */
export const nav = $state<{ route: RouteId; query: URLSearchParams }>({
  route: DEFAULT_ROUTE,
  query: new URLSearchParams(),
})

function sync() {
  const parsed = parseHash(window.location.hash)
  nav.route = parsed.route
  nav.query = parsed.query
}

export function initRouter() {
  if (!window.location.hash) {
    // replace evita ensuciar el historial al abrir la app.
    window.history.replaceState(null, '', `#/${DEFAULT_ROUTE}`)
  }
  sync()
  window.addEventListener('hashchange', sync)
}

export function go(route: RouteId, query?: Record<string, string>) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
  window.location.hash = `#/${route}${qs}`
}
