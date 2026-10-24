# Errata de `planning.md` tras el rediseño

> `planning.md` conserva el plan aprobado original. El rediseño ya implementado en `src/` reemplaza varias secciones. Esta nota lista las contradicciones para que el plan se corrija sin perder las fórmulas de facturación que siguen vigentes.

## Lo que cambió

| Sección de `planning.md` | Qué dice el plan viejo                                                                                    | Qué hace la app                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 2, 7                     | Router con `#/hoy`, `#/lecturas`, `#/graficas`, `#/analisis`, `#/ajustes`, `#/instrucciones` y bottom nav | Una sola página (`Medidor.svelte`) + diálogo de Configuración                                                  |
| 3.5                      | Tarifas editables, toggles de componentes y restaurar ARESEP                                              | Tarifas ARESEP de solo lectura; solo tabla combinada                                                           |
| 3.6                      | Tres escenarios de proyección y “peor escenario”                                                          | Una sola proyección: promedio L/día de los últimos 7 días con datos del ciclo                                  |
| 3.6.1, 4.2               | Cierre manual, base editable, `billedM3`, `actualBill`, auditoría                                         | Ciclos derivados 20 → 20; base = última medición anterior al 20; sin cierre ni ajustes                         |
| 3.7, 6.1                 | Parseo de cantidades en notas y señales de fuga por nota                                                  | La nota es texto libre; no se parsea ni genera señales                                                         |
| 4.3                      | `Settings` persistidos, `projection`, `gapWarnHours`, `gist`                                              | Estado solo con `readings`; tema en `localStorage`                                                             |
| 5                        | IndexedDB + gist público, PAT, pull/push/merge, import/export JSON, backup                                | IndexedDB + lectura del CSV público de Google Sheets; sin gist, token, escritura, import/export JSON ni backup |
| 6                        | 60 filas y ciclos con base 100.283                                                                        | 66 filas semilla; ciclo 2026-10 con base 100.156                                                               |
| 7.2                      | Filtros, tags, flags, borrado, resumen Markdown                                                           | Tabla cruda de solo lectura con búsqueda y favorito local; sin tags, filtros ni borrado                        |
| 7.3                      | Selector 7d/30d/ciclo/todo, gráficas de costo e historial                                                 | Dos gráficas: curva de consumo en m³/día y periodo anterior vs actual en ₡ estimados                           |
| 7.5                      | Cierre de ciclo, tarifas editables, proyección, gist, import/export, reset                                | Ciclo y tarifas de solo lectura; sync de la hoja; export CSV; tema; acerca de                                  |
| 8                        | Alerta roja bloqueante por días faltantes                                                                 | Aviso suave en la tarjeta del ciclo                                                                            |
| 9                        | Hash routing                                                                                              | `start_url: './'`, una sola ruta                                                                               |
| 10                       | Tests de cierre manual, notas, merge y backup                                                             | 78 tests de dominio; sin cierre manual, notas ni backup; merge hoja↔local testeado                             |
| 13                       | “La final medición es la base editable”                                                                   | La base se deriva; no se edita                                                                                 |

## Fuente de datos

- La fuente viva es el **CSV publicado de Google Sheets** (`pub?output=csv`), de solo lectura. CORS es `*`, así que la PWA hace `fetch` directo sin proxy ni token.
- La hoja solo guarda `fecha,medicion,nota`; consumo, Δ, factura y proyecciones se calculan en la PWA.
- El sync corre al arrancar, al volver a la pestaña y al recuperar red, con `cache: 'no-store'`.
- `mergeSheetReadings` une por `fecha|medicion`: la hoja manda en valor y nota; `flag` y `tags` locales se conservan; las filas locales fuera de la hoja se avisan y no se borran.
- `src/data.csv` queda como semilla y respaldo sin red. No se escribe la hoja desde la app: el alta y la corrección se hacen en Google Sheets.
- La hoja publicada es pública: las notas con nombres quedan visibles para quien tenga el link.

## Lo que sigue vigente

- Tarifas ARESEP 2026-10-23 y tabla combinada.
- `exacto = actual − base`; `facturable = floor(actual) − floor(base)`.
- IVA del 13% sobre **todo el acueducto** si el consumo facturable > 30 m³.
- Salto 30 → 31 m³: ₡5,214.70.
- `data.csv` atómico: solo `fecha,medicion,nota`.
- Derivados en memoria; fechas en `America/Costa_Rica`.
- Lenguaje es-CR aproximado; la factura es una estimación.

## Datos actuales

- `src/data.csv`: 66 filas, 2026-09-20 07:00 → 2026-10-24 09:07.
- Se completaron 20, 21, 22 y 23 de setiembre: `73.000`, `74.635`, `76.270`, `77.905`; el 24 real es `79.656`.
- Ciclo 2026-09: base `73.000`, 58 mediciones, última `100.156`.
- Ciclo 2026-10: base `100.156` (19 oct 21:50), 8 mediciones, última `103.910`.
- Consumo actual: exacto `3.754 m³`, facturable `3 m³`.

## Fuera de alcance

Gist, token, escritura en la hoja, import/export JSON, backup, reset, cierre manual, auditoría de ajustes, parseo de notas, alta/edición dentro de la app, tags/flags editables, filtros de flags, borrado, selector 7d/30d/todo, what-if con slider, tarifas editables y alerta bloqueante.
