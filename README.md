# Medidor AYA

App personal, offline-first e instalable como PWA para **leer la medición del medidor y el consumo de agua por ciclo 20 → 20**. Las mediciones se editan en una hoja de Google Sheets publicada; la app solo lee. No es la factura oficial de AYA: la app estima y avisa; el recibo real manda.

## Qué es y qué no es

- **Una sola página.** De arriba hacia abajo están el ciclo, las gráficas y la tabla cruda. No hay botón de agregar ni de editar.
- **La hoja es la única fuente.** La app lee el CSV publicado de Google Sheets al abrir, al volver a la pestaña, al recuperar red o al tocar la flecha circular de la cabecera. La hoja solo tiene `fecha,medicion,nota`; el consumo, los litros, la factura y las proyecciones se calculan en la PWA. Si no hay mediciones, la pantalla muestra **Todavía no hay mediciones** y el botón **Sincronizar hoja**.
- **Solo lectura.** No hay alta ni edición dentro de la app. Para corregir o agregar una medición, editá la hoja y sincronizá.
- **Configuración en un diálogo.** Se abre con el engranaje de la cabecera. Incluye el estado del sync y **Descargar CSV**. El refresh y el cambio de tema están en la cabecera.
- **Sin datos de fábrica.** La hoja es la única fuente. La primera sincronización necesita red una vez; después la app abre sin red con la última copia guardada. No hay cuenta, gist ni token.
- **PWA.** Se instala desde el navegador, abre sin red después de la primera sync y avisa cuando hay una versión nueva.
- **La factura es una estimación.** Se calcula con tarifas ARESEP de solo lectura; el recibo de AYA manda.

## Flujo de la pantalla

1. **Ciclo actual:** promedio diario desde el corte, cuatro métricas (consumo, lectura anterior, factura aproximada y promedio actual vs anterior) y barra 0–60 m³ con ticks cada 5 y bloques verde/amarillo/rojo.
2. **Gráficas:** **Consumo** arriba y **Facturación** abajo, a todo el ancho. **Consumo** en m³ por día del ciclo con barras verticales agrupadas: día 1 = 20, anterior gris, actual azul, sin proyección. **Facturación** en ₡ estimados sigue acumulada, con actual azul, anterior gris, proyección punteada y un punto por cada bloque tarifario nuevo.
3. **Mediciones:** tabla cruda a todo el ancho, debajo de las gráficas, con fecha AM/PM, medición, Δ m³, Δ L, horas enteras, L/h y nota. En móvil se ocultan Δ m³, horas y nota. Es de solo lectura; solo el favorito es local.
4. **Configuración:** ciclo y tarifas de solo lectura, estado de la hoja, sincronización, **Descargar CSV**, tema y “acerca de”.

Ejemplo con la hoja al 24-OCT: medición `103.910 m³`, base del ciclo `100.156 m³`, consumo exacto `3.754 m³` y facturable `3 m³`.

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
bun run test         # 88 tests del dominio
bun run build        # dist/ + service worker
bun run preview      # probar el build y la PWA
bun run lint
bun run format
```

CI usa Node 22 LTS con Bun (`oven-sh/setup-bun`) y `bun install --frozen-lockfile`.

Los tests de dominio no leen ningún CSV: usan la foto histórica de la ex semilla en `src/lib/domain/__fixtures__/mediciones.ts`.

## Estructura

```text
src/
  App.svelte              cabecera, tema, sync inicial, diálogo de Configuración
  routes/Medidor.svelte   única página: ciclo, gráficas y tabla
  lib/
    domain/               cálculo puro: ciclos, facturación, promedios, outliers, CSV
      initialState.ts     arranque vacío; la hoja es la única fuente
      __fixtures__/       foto histórica de 66 lecturas, solo para tests
    state/                IndexedDB, store con runes, sync de la hoja, derivados y toasts
    components/           tarjeta de ciclo, tabla, diálogos, iconos, swipe
    charts/               Chart.js con tema plano
instructions.md           manual de usuario del repo; no se renderiza dentro de la app
planning.md               plan aprobado original; ver docs/planning-errata.md
docs/                     notas técnicas, incluida la errata del plan
AGENTS.md                 convenciones para agentes
.opencode/                agentes y skills del proyecto
```

## PWA y offline

- Una sola ruta: `start_url` y `scope` son `./`; no hay hash routing.
- El service worker precachea el shell (`js`, `css`, `html`, iconos). La app no incluye mediciones en el bundle: el primer arranque sin red muestra el estado vacío hasta que sincronices una vez.
- IndexedDB guarda la copia local de las mediciones; si el navegador no la permite, se usa un respaldo en `localStorage`.
- Al abrir, al volver a la pestaña, al recuperar red o al tocar el refresh de la cabecera, la app intenta leer la hoja publicada. Si falla o no hay red, sigue con la copia local; si nunca sincronizó, no hay datos que mostrar.
- El service worker usa `registerType: 'prompt'`: la app no recarga sola. Cuando hay una versión nueva, aparece **Actualizar / Después**.
- No hay banner de instalación. Para instalar, usá el menú del navegador; en iOS, Compartir → Agregar a pantalla de inicio.

## Datos y privacidad

- **Fuente única:** CSV publicado de Google Sheets. La hoja solo guarda `fecha,medicion,nota`; nada derivado.
- **Merge por `fecha|medicion`:** la hoja manda en los valores y las notas; los favoritos locales se conservan por clave. Las filas locales que no estén en la hoja no se borran: se avisan como “N filas locales no están en la hoja”.
- **Sin semilla local.** La app arranca con 0 mediciones y la hoja es la única fuente. La primera sincronización necesita red; IndexedDB guarda la copia para después.
- El parser acepta `MM/DD/YYYY hh:mm AM/PM` (el formato viejo de la hoja) e ISO 8601. **Descargar CSV** genera `medidor.csv` en ISO con offset `-06:00` desde la copia en memoria.
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
