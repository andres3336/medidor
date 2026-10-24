# Medidor AYA

App personal, offline-first e instalable como PWA para **detectar anomalías de consumo de agua y actuar rápido**. No es la factura oficial de AYA: la app estima y avisa; el recibo real manda.

## Qué hace

- **Radar diario:** ayer vs tu mediana, multiplicador y equivalencia en días normales.
- **Fugas:** L/h entre lecturas, flujo basal, consumo nocturno y costo mensual estimado.
- **Notas vs medidor:** detecta litros no explicados por la nota (ej. 23 L medidos vs 6 L explicados).
- **Factura estimada:** tarifas ARESEP, IVA del 13% sobre todo el acueducto si pasás 30 m³.
- **Cierre de ciclo manual:** lectura final, consumo facturado y auditoría de cada ajuste.
- **Datos locales:** IndexedDB, CSV atómico, backup JSON, resumen Markdown para chat.
- **PWA:** se instala, abre sin conexión y avisa cuando hay una versión nueva.

## Stack

- Svelte 5 (runes) + Vite 8 + TypeScript.
- Bun para dependencias y scripts.
- Chart.js con import dinámico solo en Gráficas.
- `vite-plugin-pwa` (Workbox) para precache del shell.
- Vitest para el dominio.

## Comandos

```sh
bun install
bun run dev        # http://localhost:5173
bun run check      # svelte-check + tsc
bun run test       # tests del dominio
bun run build      # dist/ + service worker
bun run preview    # probar el build y la PWA
```

CI usa Node 22 LTS con Bun (`oven-sh/setup-bun`). El contenedor local puede tener Node 26; no hace falta.

## Estructura

```
src/
  routes/            Hoy, Lecturas, Gráficas, Análisis, Ajustes, Instrucciones
  lib/
    domain/          tarifas, facturación, ciclos, fugas, outliers, CSV, resumen
    state/           IndexedDB, store con runes, derivados, backup
    components/      tarjetas, modales, radar, iconos
    data.csv?raw     no: la semilla es /data.csv en la raíz
data.csv             única fuente de lecturas (fecha,medicion,nota)
instructions.md      manual que se renderiza en #/instrucciones
planning.md          alcance aprobado
AGENTS.md            convenciones para agentes
.opencode/           agentes y skills del proyecto
```

## PWA y offline

- `display: standalone`, `start_url` y `scope` relativos, hash routing (`#/hoy`).
- El shell (`js`, `css`, `html`, iconos) y las lecturas semilla quedan precacheados.
- Los datos viven en IndexedDB; `localStorage` solo guarda el token del gist y preferencias.
- El service worker usa `registerType: 'prompt'`: nunca recarga solo ni pierde un formulario.
- Instalación: Chrome/Android desde el banner o menú; iOS desde Compartir → Agregar a pantalla de inicio.

## Datos y privacidad

- `data.csv` solo guarda `fecha,medicion,nota`. Consumo, litros, L/h y costos se calculan al vuelo.
- El gist es opcional y público si lo creás. El token de GitHub nunca se commitea.
- No hay analytics, fuentes externas ni CDN.

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

- `instructions.md`: manual de usuario (también dentro de la app).
- `planning.md`: decisiones y alcance.
- `AGENTS.md`: cómo trabajar en el repo.
- `.opencode/skills/medidor-dominio/SKILL.md`: reglas normativas de cálculo.
