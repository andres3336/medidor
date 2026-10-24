# Medidor AYA — convenciones del repo

## Contexto

App personal de una sola persona para leer la medición del medidor y el consumo de agua por ciclo 20 → 20. Las mediciones se editan en una hoja publicada de Google Sheets; la PWA solo lee y calcula. La app es una sola página con un diálogo de Configuración. El plan aprobado está en `planning.md`; el rediseño implementado se describe en este archivo, `README.md` e `instructions.md`. Las secciones del plan que quedaron obsoletas están señaladas en `docs/planning-errata.md`. Las reglas de cálculo están en `.opencode/skills/medidor-dominio/SKILL.md`. Si el código difiere de esos documentos, corregí el código o la documentación; no inventes funciones.

## Stack

- Svelte 5 con runes, Vite 8, TypeScript estricto.
- Bun (`bun install`, `bun run …`). `bun.lock` se commitea.
- Melt UI next-gen: paquete `melt` (`Dialog`, `Progress`). No usar `@melt-ui/svelte` legacy.
- Chart.js con import dinámico y tema plano tipo Plotly.
- Vitest + jsdom para el dominio.
- PWA con `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`).
- Deploy a GitHub Pages desde `main`.

## Comandos

```sh
bun run dev          # desarrollo
bun run check        # svelte-check + tsc
bun run test         # 78 tests del dominio
bun run build        # dist + sw.js
bun run preview      # probar PWA real
bun run lint
bun run format
```

Definición de terminado: `check`, `test` y `build` en verde; sin errores nuevos de consola; la PWA sigue precacheando el shell y abre sin red.

## Invariantes (no negociables)

1. La hoja de Google Sheets y `data.csv` solo tienen `fecha,medicion,nota`. Nada de columnas derivadas.
2. El IVA se aplica a **todo el acueducto** cuando el consumo facturable > 30 m³.
3. Las lecturas se truncan con `floor` antes de restar; el dinero se redondea hacia arriba solo al mostrar.
4. Los ciclos se derivan 20 → 20. La base es la última medición **anterior** al día 20 a las 00:00; en el primer ciclo se usa la primera medición del ciclo. No hay cierre manual, base editable ni ajustes auditados.
5. Los derivados (consumo, L/h, mediana, factura, proyecciones, outliers) se calculan en memoria.
6. No hay gist ni token. La hoja publicada es de **solo lectura**: la PWA no la escribe. Un PAT nunca vive en el repo, el estado, IndexedDB, `localStorage`, el CSV ni los logs.
7. Fechas en `America/Costa_Rica` (UTC-6, sin DST).
8. La app debe abrir y operar sin red con la copia en IndexedDB y la semilla `src/data.csv`. No hay cuenta. El sync es un `fetch` del CSV público; si falla, se sigue local.
9. Lenguaje es-CR, aproximado: “posible fuga”, “≈”, “normal/raro”. Nada de falsa precisión.
10. Cada regla de dominio nueva lleva test con un caso real de `data.csv` o de la tabla del planning.
11. Una sola página (`src/routes/Medidor.svelte`) y un diálogo de Configuración. No hay router, bottom nav ni pantallas viejas.
12. No reintroduzcas gist, import/export JSON, backup, reset, cierre manual, parseo de notas ni filtros de tags/flags sin actualizar el plan, el skill y los tests.
13. No hay alta ni edición dentro de la app: la tabla es de solo lectura. El alta y la corrección se hacen en Google Sheets. El favorito (`flag`) es local y no viaja a la hoja.
14. El merge hoja↔local es por `fecha|medicion`: la hoja manda en valor y nota, los flags locales se conservan y las filas locales fuera de la hoja se avisan, no se borran.

## Estructura

- `src/App.svelte`: shell, cabecera, tema, badge offline, sync inicial y diálogo de Configuración.
- `src/routes/Medidor.svelte`: única página; ordena ciclo, gráficas y tabla.
- `src/lib/domain/`: lógica pura, sin Svelte ni DOM. Es la parte más testeada.
- `src/lib/state/`: IndexedDB, store con runes, sync de la hoja (`sheetSync.svelte.ts`), derivados y toasts. Puede usar Svelte.
- `src/lib/components/`: UI reutilizable (ciclo, tabla, diálogos, iconos, swipe).
- `src/lib/charts/`: Chart.js y tema.
- `src/data.csv`: semilla y respaldo sin red; se importa con `?raw`.
- `instructions.md`: manual de usuario del repo; **no** se renderiza dentro de la app.
- `src/lib/domain/backup.ts`: normaliza el estado guardado; no es una función de backup visible.
- Tests: `src/lib/domain/*.test.ts`.

## Estilo

- UI y docs en español de Costa Rica; identificadores y commits en inglés técnico con asunto español.
- Fechas visibles en `DD-MMM` mayúscula (`23-OCT`); la tabla agrega hora AM/PM.
- Barra del ciclo 0–60 m³, ticks cada 5, bloques verde/amarillo/rojo.
- Componentes Svelte 5 con `$props`, `$state`, `$derived`, `$effect`; evitar stores legacy.
- Melt UI con builders next-gen; no mezclar con la API legacy.
- CSS con variables de `src/app.css`, mobile-first, targets de 44 px, `prefers-reduced-motion`.
- Sin dependencias nuevas sin justificarlo (peso, mantenimiento, offline).
- Funciones de dominio puras y con parámetros explícitos (`now` inyectable para tests).
- La tabla muestra datos crudos; no agregues columnas derivadas al CSV.

## Agentes disponibles

- `git`: ramas, commits, PR. No edita código.
- `docs`: README, `instructions.md`, `AGENTS.md`, `docs/` y `.opencode/`. No toca `src/`.
- `reviewer`: solo lectura; valida invariantes, tests y PWA.

Los skills (`medidor-dominio`, `git-flow`, `docs-es-cr`) son la fuente de verdad operativa. Cargalos antes de tocar esas áreas.

## Fuera de alcance (v1)

Chat/LLM embebido, multiusuario, gist/token, escritura en la hoja, import/export JSON, backup, reset, cierre manual de ciclo, alta/edición dentro de la app, parseo de notas, tags/flags editables, filtros de flags, borrado de mediciones, selector 7d/30d/todo, what-if con slider, tarifas editables, alerta bloqueante por días faltantes, scraping de tarifas, cifrado del gist, app nativa y notificaciones push.
