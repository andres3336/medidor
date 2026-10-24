# Medidor AYA

App personal, offline-first e instalable como PWA para **leer la medición del medidor y el consumo de agua por ciclo 20 → 20**. Las mediciones se editan en una hoja de Google Sheets publicada; la app solo lee. No es la factura oficial de AYA: la app estima y avisa; el recibo real manda.

## Qué es y qué no es

- **Una sola página.** De arriba hacia abajo están el ciclo, las gráficas y la tabla cruda. No hay botón de agregar ni de editar.
- **La hoja es la fuente.** La app lee el CSV publicado de Google Sheets al abrir, al volver a la pestaña y al recuperar red. La hoja solo tiene `fecha,medicion,nota`; el consumo, los litros, la factura y las proyecciones se calculan en la PWA.
- **Solo lectura.** No hay alta ni edición dentro de la app. Para corregir o agregar una medición, editá la hoja y sincronizá.
- **Configuración en un diálogo.** Se abre con el engranaje de la cabecera. Incluye el estado del sync y el botón **Sincronizar hoja**.
- **Datos locales.** IndexedDB guarda una copia para funcionar sin red. No hay cuenta, gist ni token.
- **PWA.** Se instala desde el navegador, abre sin red y avisa cuando hay una versión nueva.
- **La factura es una estimación.** Se calcula con tarifas ARESEP de solo lectura; el recibo de AYA manda.

## Flujo de la pantalla

1. **Ciclo actual:** promedio diario desde el corte, tres métricas (consumo, lectura anterior y factura aproximada) y barra 0–60 m³ con ticks cada 5 y bloques verde/amarillo/rojo.
2. **Gráficas:** dos tarjetas lado a lado en desktop, siempre actual vs anterior por día de ciclo. **Curva de consumo** en m³/día y **Periodo anterior vs actual** en ₡ estimados acumulados, con actual azul (área rellena) y anterior gris claro.
3. **Mediciones:** tabla cruda a todo el ancho, debajo de las gráficas, con fecha AM/PM, medición, Δ m³, Δ L, horas enteras, L/h y nota. En móvil se ocultan Δ m³, horas y nota. Es de solo lectura; solo el favorito es local.
4. **Configuración:** ciclo y tarifas de solo lectura, estado de la hoja, sincronización, descarga de `data.csv`, tema y “acerca de”.

Ejemplo con los datos semilla: medición `103.910 m³`, base del ciclo `100.156 m³`, consumo exacto `3.754 m³` y facturable `3 m³`.

## Stack

- Svelte 5 con runes, Vite 8 y TypeScript estricto.
- Bun para dependencias y scripts.
- Melt UI next-gen (`melt`), no `@melt-ui/svelte` legacy: `Dialog` y `Progress`.
- Chart.js con import dinámico y tema plano tipo Plotly.
- `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`).
- Vitest + jsdom para el dominio.

## Comandos

```sh
bun install
bun run dev          # http://localhost:5173
bun run check        # svelte-check + tsc
bun run test         # 78 tests del dominio
bun run build        # dist/ + service worker
bun run preview      # probar el build y la PWA
bun run lint
bun run format
```

CI usa Node 22 LTS con Bun (`oven-sh/setup-bun`) y `bun install --frozen-lockfile`.

## Estructura

```text
src/
  App.svelte              cabecera, tema, sync inicial, diálogo de Configuración
  routes/Medidor.svelte   única página: ciclo, gráficas y tabla
  lib/
    domain/               cálculo puro: ciclos, facturación, promedios, outliers, CSV
    state/                IndexedDB, store con runes, sync de la hoja, derivados y toasts
    components/           tarjeta de ciclo, tabla, diálogos, iconos, swipe
    charts/               Chart.js con tema plano
src/data.csv              semilla y respaldo sin red (66 filas)
instructions.md           manual de usuario del repo; no se renderiza dentro de la app
planning.md               plan aprobado original; ver docs/planning-errata.md
docs/                     notas técnicas, incluida la errata del plan
AGENTS.md                 convenciones para agentes
.opencode/                agentes y skills del proyecto
```

## PWA y offline

- Una sola ruta: `start_url` y `scope` son `./`; no hay hash routing.
- El service worker precachea el shell (`js`, `css`, `html`, iconos). `src/data.csv` viaja dentro del bundle como semilla.
- IndexedDB guarda la copia local de las mediciones; si el navegador no la permite, se usa un respaldo en `localStorage`.
- Al abrir, al volver a la pestaña y al recuperar red, la app intenta leer la hoja publicada. Si falla o no hay red, sigue con la copia local.
- El service worker usa `registerType: 'prompt'`: la app no recarga sola. Cuando hay una versión nueva, aparece **Actualizar / Después**.
- No hay banner de instalación. Para instalar, usá el menú del navegador; en iOS, Compartir → Agregar a pantalla de inicio.

## Datos y privacidad

- **Fuente viva:** CSV publicado de Google Sheets. La hoja solo guarda `fecha,medicion,nota`; nada derivado.
- **Merge por `fecha|medicion`:** la hoja manda en los valores y las notas; los favoritos locales se conservan por clave. Las filas locales que no estén en la hoja no se borran: se avisan como “N filas locales no están en la hoja”.
- **Semilla:** `src/data.csv` tiene **66 mediciones**, del 20 de setiembre al 24 de octubre de 2026, y sirve para arrancar sin red o con la hoja vacía.
- El archivo semilla usa `MM/DD/YYYY hh:mm AM/PM`; la app acepta ese formato y también ISO 8601. Al descargar, exporta ISO con offset `-06:00`.
- No hay gist, token, cuenta, analytics ni CDN. La app no escribe en la hoja: solo hace `fetch` de una URL pública con CORS.
- **La hoja es pública.** Quien tenga el link puede leer las notas, incluidos nombres o direcciones. Si eso molesta, hay que pasar a una hoja privada con OAuth o a una base con autenticación.
- En `localStorage` solo quedan el tema y, si hace falta, el respaldo del estado. Al arrancar se limpian las claves viejas del token del gist.

## Deploy

GitHub Pages desde `main` con `.github/workflows/deploy.yml`:

1. `bun install --frozen-lockfile`
2. `bun run check`
3. `bun run test`
4. `bun run build`
5. `actions/deploy-pages`

Antes del primer deploy, habilitá Pages con origen **GitHub Actions**:

```sh
gh api -X POST repos/andres3336/medidor/pages -f build_type=workflow
```

Sitio: <https://andres3336.github.io/medidor/>

## Documentación

- `instructions.md`: manual de usuario para el repo.
- `planning.md`: plan aprobado original, con fórmulas y decisiones.
- `docs/planning-errata.md`: qué secciones del plan reemplazó el rediseño.
- `AGENTS.md`: cómo trabajar en el repo.
- `.opencode/skills/medidor-dominio/SKILL.md`: reglas normativas de cálculo.
