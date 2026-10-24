# Medidor AYA — convenciones del repo

## Contexto

App personal de una sola persona para detectar anomalías de consumo de agua. El plan aprobado está en `planning.md`; las reglas de cálculo en `.opencode/skills/medidor-dominio/SKILL.md`. Si hay conflicto, gana el plan y el skill, no el código.

## Stack

- Svelte 5 con runes, Vite 8, TypeScript estricto.
- Bun (`bun install`, `bun run …`). `bun.lock` se commitea.
- Vitest + jsdom. Chart.js con import dinámico.
- PWA con `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`).
- Deploy a GitHub Pages desde `main`.

## Comandos

```sh
bun run dev          # desarrollo
bun run check        # svelte-check + tsc
bun run test         # dominio
bun run build        # dist + sw.js
bun run preview      # probar PWA real
bun run lint
bun run format
```

Definición de terminado: `check`, `test` y `build` en verde; sin errores nuevos de consola; PWA sigue precacheando el shell.

## Invariantes (no negociables)

1. `data.csv` solo tiene `fecha,medicion,nota`. Nada de columnas derivadas.
2. El IVA se aplica a **todo el acueducto** cuando el consumo facturable > 30 m³.
3. Las lecturas se truncan con `floor` antes de restar; el dinero se redondea hacia arriba solo al mostrar.
4. El ciclo se cierra manualmente y cada ajuste queda auditado. Nunca auto-cerrar ni inventar base.
5. Los derivados (consumo, L/h, mediana, factura, proyecciones) se calculan en memoria.
6. El token del gist vive solo en `localStorage`; jamás en el repo, el gist o un log.
7. Fechas en `America/Costa_Rica` (UTC-6, sin DST).
8. La app debe abrir y operar sin red; el gist es un extra opcional.
9. Lenguaje es-CR, aproximado: “posible fuga”, “≈”, “normal/raro”. Nada de falsa precisión.
10. Cada regla de dominio nueva lleva test con un caso real de `data.csv` o de la tabla del planning.

## Estructura

- `src/lib/domain/`: lógica pura, sin Svelte ni DOM. Es la parte más testeada.
- `src/lib/state/`: IndexedDB, store con runes, derivados y backup. Puede usar Svelte.
- `src/routes/`: pantallas. No calculan dinero; consumen `deriveAnalytics`.
- `src/lib/components/`: UI reutilizable, sin lógica de negocio.
- `data.csv` (raíz): semilla y única fuente de lecturas; se importa con `?raw`.
- `instructions.md`: manual de usuario; se renderiza con snarkdown.

## Estilo

- UI y docs en español de Costa Rica; identificadores y commits en inglés técnico con asunto español.
- Componentes Svelte 5 con `$props`, `$state`, `$derived`, `$effect`; evitar stores legacy.
- CSS con variables de `src/app.css`, mobile-first, targets de 44 px, `prefers-reduced-motion`.
- Sin dependencias nuevas sin justificarlo (peso, mantenimiento, offline).
- Funciones de dominio puras y con parámetros explícitos (`now` inyectable para tests).

## Agentes disponibles

- `git`: ramas, commits, PR. No edita código.
- `docs`: README, `instructions.md`, `docs/`. No toca `src/`.
- `reviewer`: solo lectura; valida invariantes, tests y PWA.

Los skills (`medidor-dominio`, `git-flow`, `docs-es-cr`) son la fuente de verdad operativa. Cargalos antes de tocar esas áreas.

## Cosas que están fuera de alcance (v1)

Chat/LLM embebido, multiusuario, scraping de tarifas, cifrado del gist, app nativa, notificaciones push.
