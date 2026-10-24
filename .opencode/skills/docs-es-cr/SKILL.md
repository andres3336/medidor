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
| `instructions.md` | usuario final | manual del repo; **no** se renderiza dentro de la app |
| `AGENTS.md` | agentes | convenciones, invariantes, comandos |
| `planning.md` | equipo | plan aprobado original; ver `docs/planning-errata.md` |
| `docs/` | técnico | decisiones puntuales, si hacen falta |

## Reglas de actualización

- Si cambia una fórmula, actualizá `instructions.md`, el skill `medidor-dominio` y los tests en el mismo cambio.
- Si cambia un comando o el stack, actualizá `README.md` y `AGENTS.md`.
- Si una feature todavía no existe, no la documentes como disponible: marcala como fase futura.
- Los números de ejemplo salen de `data.csv` y de los tests; no los inventes.
- La app es una sola página + diálogo de Configuración. No documentes router, bottom nav ni pantallas viejas.
- La app lee la hoja publicada de Google Sheets y no la escribe; no documentes alta/edición dentro de la app.
- No reintroduzcas gist, token, import/export JSON, backup, cierre manual ni parseo de notas.

## README mínimo

1. Qué hace y qué no hace.
2. Requisitos (Bun, Node 22+ para CI).
3. `bun install`, `bun run dev`, `bun run check`, `bun run test`, `bun run build`.
4. Estructura de carpetas actual.
5. PWA: instalación, offline, update.
6. Datos y privacidad: IndexedDB, hoja de Google Sheets de solo lectura, CSV atómico, semilla local, sin gist ni token.
7. Deploy en GitHub Pages.

## instructions.md mínimo

Qué es, pantalla única, cómo agregar o corregir en Google Sheets y sincronizar, ciclo 20 → 20 y base derivada, barra de bloques, proyección de 7 días, tabla cruda de solo lectura, outliers por ciclo, dos gráficas, Configuración, CSV, offline/PWA, privacidad, glosario y limitaciones.

## Accesibilidad del texto

- Encabezados jerárquicos, sin saltar niveles.
- Nada de “click aquí”: describí la acción.
- Números con separador de miles y unidad (`1,517 L`), no solo el número.
