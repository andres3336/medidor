---
name: Documentación es-CR
description: Voz, estructura y mapa de documentación del Medidor AYA en español de Costa Rica. Cargar antes de escribir README, instructions.md o docs.
---

# Documentación es-CR

## Voz

- Español de Costa Rica, tuteo neutro: “tocá”, “elegí”, “revisá”, “podés”.
- Frases cortas. Una idea por párrafo.
- Sin centavos ni falsa precisión: “≈”, “normal”, “raro”, “posible fuga”.
- La factura es una estimación; el recibo real de AYA manda.
- No prometas exactitud contable ni “detección de fugas confirmada”.

## Mapa de documentos

| Archivo | Audiencia | Contenido |
|---|---|---|
| `README.md` | quien clona | qué es, stack, comandos, estructura, deploy, PWA |
| `instructions.md` | usuario final | manual dentro de #/instrucciones |
| `AGENTS.md` | agentes | convenciones, invariantes, comandos |
| `planning.md` | equipo | alcance aprobado; no reescribir |
| `docs/` | técnico | decisiones puntuales, si hacen falta |

## Reglas de actualización

- Si cambia una fórmula, actualizá `instructions.md`, el skill `medidor-dominio` y los tests en el mismo cambio.
- Si cambia un comando o el stack, actualizá `README.md` y `AGENTS.md`.
- Si una feature todavía no existe, no la documentes como disponible: marcala como fase futura.
- Los números de ejemplo salen de `data.csv` y de los tests; no los inventes.

## README mínimo

1. Qué hace y qué no hace.
2. Requisitos (Bun, Node 22+ para CI).
3. `bun install`, `bun run dev`, `bun run check`, `bun run test`, `bun run build`.
4. Estructura de carpetas.
5. PWA: instalación, offline, update.
6. Datos y privacidad: IndexedDB, CSV, gist opcional.
7. Deploy en GitHub Pages.

## instructions.md mínimo

Qué es, agregar lectura, ciclo/corte/base, fórmula y tarifas, exacto vs facturable, salto de IVA, fugas, notas vs medidor, gráficas/outliers, cierre manual, días faltantes, flags/tags, CSV/resumen, gist/backup/privacidad, glosario, limitaciones.

## Accesibilidad del texto

- Encabezados jerárquicos, sin saltar niveles.
- Nada de “click aquí”: describí la acción.
- Números con separador de miles y unidad (`1,517 L`), no solo el número.
