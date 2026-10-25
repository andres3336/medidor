---
name: Dominio Medidor AYA
description: Reglas normativas de facturación, ciclos derivados, lecturas, proyección, outliers, promedios, CSV y sync con Google Sheets del Medidor AYA. Cargar antes de tocar src/lib/domain, src/lib/state/sheetSync.svelte.ts o cualquier cálculo de dinero.
---

# Dominio Medidor AYA

Este skill es la verdad operativa del proyecto. Si el código y este documento difieren, gana el documento y hay que corregir el código con tests.

## Regla de oro

La hoja publicada de Google Sheets guarda **solo** `fecha,medicion,nota`. Consumo, Δ, litros, L/h, costos, proyecciones y outliers son derivados y se recalculan en memoria. Nunca los persistas ni los agregues como columnas.

- **Fuente única:** CSV publicado de Google Sheets, solo lectura.
- **Sin semilla local:** `buildInitialState()` devuelve `readings: []`; no hay datos de fábrica ni CSV empaquetado.
- **Caché:** IndexedDB guarda la copia de la última sync. La primera carga necesita red una vez; después la app abre sin red.
- La app **no escribe** la hoja. El alta y la edición se hacen en Google Sheets; la PWA solo lee y mergea.

## Unidades y formatos

- m³, consumo y medición: hasta 3 decimales.
- Litros: enteros.
- L/h: 1 decimal.
- Dinero: colones, sin centavos al mostrar. `Math.ceil` al colón.
- Números: punto decimal y coma de miles (`1,234.567`), como el CSV original.
- Fechas: ISO 8601 con offset `-06:00`; Costa Rica no tiene DST. El parser acepta también `MM/DD/YYYY hh:mm AM/PM`.
- La UI muestra las fechas en `DD-MMM` mayúscula (`23-OCT`, `20-NOV`). La tabla agrega hora AM/PM.
- El CSV exportado usa ISO con `-06:00`; la hoja puede venir en el formato viejo `MM/DD/YYYY hh:mm AM/PM`.

## Lecturas y consumo

```
exacto     = medicion_actual - base
facturable = floor(medicion_actual) - floor(base)
```

Si el facturable es negativo, se muestra 0 y se marca dato dudoso.

Ejemplo canónico del ciclo actual: base `100.156`, medición `103.910` → exacto `3.754`, facturable `3`.

En la foto histórica de tests, el ciclo 2026-09 va de base `73.000` a `100.156` → exacto `27.156`, facturable `27`.

En la hoja viva no hay mediciones antes del 24 de setiembre: el ciclo 2026-09 arranca con la primera lectura (`79.656`) como base.

`100.283` **no** es la base del ciclo actual: es una medición del 20 de octubre que pertenece al ciclo `2026-10`.

## Facturación (ARESEP 2026-10-23)

Tarifas combinadas por m³: bloque 1–15 = 873; 16–30 = 1,772; 31–60 = 2,239; 61+ = 3,849. Cargo fijo combinado = 3,200 (acueducto 2,000 + alcantarillado 1,200).

Componentes por bloque:

- acueducto: 437, 875, 1,210, 2,005
- alcantarillado: 408, 867, 997, 1,807
- hidrantes: 23, 24, 26, 30
- TPRH: 5, 6, 6, 7

Algoritmo:

```
u1 = min(consumo, 15)
u2 = max(0, min(consumo, 30) - 15)
u3 = max(0, min(consumo, 60) - 30)
u4 = max(0, consumo - 60)
cada componente = suma(u_i × tarifa_i) + cargo_fijo (si aplica)
iva = consumo > 30 ? acueducto_total × 0.13 : 0
total = acueducto + alcantarillado + hidrantes + tprh + iva
```

**El IVA se aplica a todo el acueducto** (bloques + cargo fijo), no solo al bloque 3. El salto de 30 a 31 m³ es de ₡5,214.70.

Las tarifas son de solo lectura en la UI. `calcBill` acepta opciones para tests, pero la app usa siempre la tabla ARESEP completa.

Vectores de validación (total exacto, sin redondear):

| m³ | total | IVA |
|---:|---:|---:|
| 3 | 5,819 | 0 |
| 15 | 16,295 | 0 |
| 27 | 37,559 | 0 |
| 30 | 42,875 | 0 |
| 31 | 48,089.70 | 2,975.70 |
| 40 | 69,656.40 | 4,391.40 |
| 44 | 79,241.60 | 5,020.60 |
| 60 | 117,582.40 | 7,537.40 |
| 61 | 121,692.05 | 7,798.05 |

Al mostrar, `displayTotal` redondea hacia arriba (31 → ₡48,090). Los tests usan el total exacto.

## Ciclos derivados 20 → 20

- Corte el día 20 a las 00:00, fijo (`CYCLE_DAY = 20`). No se configura.
- El instante exacto del corte pertenece al ciclo **nuevo** (`start <= at < end`).
- Id del ciclo: `YYYYMM` del mes de inicio. Etiqueta: `20-OCT – 20-NOV`.
- La **base** es la última medición **anterior** al inicio del ciclo. Si no existe (primer ciclo), se usa la primera medición del ciclo. Si no hay mediciones, `baseValue = null`.
- Los ciclos **no se persisten**. Se derivan de las mediciones; editar una medición del 19 cambia la base del ciclo siguiente.
- No hay cierre manual, ni lectura final ajustada, ni `billedM3`, ni `actualBill`, ni `CycleAdjustment`, ni auditoría.
- Foto histórica de la ex semilla (fixture de tests, no viaja al bundle): ciclo 2026-09 base 73.000, 58 mediciones, última 100.156; ciclo 2026-10 base 100.156 (19 oct 21:50), 8 mediciones, última 103.910. Incluye 4 días completados de setiembre y dos horas que la hoja ya corrigió.
- Promedio diario del ciclo anterior = consumo exacto del ciclo anterior dividido entre los días desde su corte hasta su última medición. Para 2026-09 da ≈ `0.91 m³/día`.
- Días faltantes: aviso suave si falta la medición de ayer o si la última tiene más de 36 h. No bloquea.

## Proyección

Una sola proyección, sin escenarios ni slider:

```
tasa = promedio de L/día de los últimos 7 días con datos del ciclo
proyección_m3 = consumo_exacto + tasa × días_restantes / 1000
días_restantes = (fin_del_ciclo - última_medición) / 24
```

- Si no hay días recientes, se usa el promedio del ciclo como respaldo.
- El facturable proyectado se calcula con `billableConsumption(medición_proyectada, base)`.
- La factura proyectada usa el mismo cálculo de bloques e IVA.
- Es el único “what-if”; no hay peor escenario, margen de seguridad ni control editable.

## Barra de bloques y promedio

- La barra va de 0 a 60 m³, con ticks cada 5 m³.
- `Bloque1` verde: 0–15. `Bloque2` amarillo: 15–30. `Bloque3` rojo: 30–60. La leyenda va centrada y no muestra `60+`.
- El relleno toma el color del bloque actual; hay marcador actual y marcador punteado de proyección.
- Si el consumo supera 60, la barra queda al tope y el texto sigue mostrando el valor real.
- La tarjeta muestra tres métricas: consumo exacto con proyección al cierre, lectura anterior con el promedio diario del ciclo anterior y factura aproximada (`≈ ₡…`, estimación, no el recibo).
- Promedio diario del ciclo = `consumo_exacto / días_desde_el_corte_hasta_hoy` en m³/día. Se muestra en la cabecera de la tarjeta; no se usa en las gráficas.
- No se usa L/h ni flujo basal en las gráficas.

## Gráficas

- Dos gráficas, siempre actual vs último, sin filtro de periodo.
- **Consumo:** m³ acumulados por día del ciclo (`día 1..N`). Línea anterior gris clara y fina, actual azul y gruesa con área rellena en azul suave, proyección actual punteada. Sin puntos salvo los hitos de bloque.
- **Facturación:** ₡ estimados acumulados por día del ciclo, misma estructura que Consumo. No mide consumo: mide la tarifa estimada con base, `floor`, bloques ARESEP, cargo fijo e IVA.
- **Hitos de bloque:** un punto por cada bloque tarifario nuevo que alcanza cada periodo (`15`, `30` y `60` m³ facturables). Sale de `findBlockMilestones` sobre la serie acumulada real, sin proyección: usa el primer punto que cruza el umbral y marca el día y el monto de ese punto. Si un punto cruza varios bloques, se marcan todos ahí. Si el ciclo no llega al bloque, no hay punto.
- Los hitos usan el color del periodo y se explican en la leyenda como “cambio de bloque”; el tooltip dice `Bloque N · 15 m³`.
- `buildBillSeries` calcula la factura de cada punto con base, `floor`, bloques ARESEP, cargo fijo e IVA. `buildBillComparison` devuelve anterior/actual y la proyección.
- Periodos de 28/30/31 días se alinean por día de ciclo hasta el máximo; es una comparación estimada.

## Notas

- La nota es texto libre. **No se parsean cantidades ni frases de fuga.**
- No existe `no_explicado`, ni señales por nota, ni acciones sugeridas automáticas.
- Los casos viejos de “23 L − 6 L = 17 L” quedaron fuera del alcance y no deben volver sin un cambio de plan.

## Serie diaria y outliers

- L/día por intervalo normalizado: última medición del día contra la última del día anterior **con datos**, dividido por las horas reales. Los huecos no generan picos.
- Los outliers se calculan **por ciclo**, solo sobre la ventana de los **últimos 14 días con datos de ese ciclo**.
- Base normal: mediana de esos 14 días, banda p25–p75, descartando valores por encima del límite.
- Outlier: `valor > max(mediana × 2, mediana + 3×MAD)`.
- Con menos de 5 días limpios, baseline insuficiente y se usa el promedio del ciclo como referencia.
- El resultado solo alimenta el icono de advertencia de la tabla (y el color rojo en la gráfica). No genera tarjetas ni conclusiones.
- Un outlier fuera de la ventana de 14 días del ciclo no se marca.

## Tabla de mediciones

- Datos crudos, más reciente arriba, una fila por medición: fecha con AM/PM, medición m³, Δ m³, Δ L, horas enteras, L/h sin unidad en la celda y nota en una sola línea.
- En móvil se ocultan Δ m³, horas y nota.
- Swipe izquierda o `F`: favorito (`flag`, fila verde). Es local y no viaja a la hoja.
- La tabla es **solo lectura**: no hay tap, Enter ni swipe derecho para editar. El alta y la corrección se hacen en Google Sheets.
- No hay borrar, iconos de acción, tags editables ni filtros de flags.
- Buscar filtra por nota o medición.
- Solo los outliers muestran el icono de advertencia al inicio de la fila.

## Estado, hoja y CSV

- `AppState` schema 2 = `{ schema, updatedAt, readings }`. Solo se persisten mediciones.
- `ReadingSource` es `'sheet' | 'app'`. `parseReadingsCsv()` marca las filas de la hoja con `source: 'sheet'`. `normalizeAppState()` acepta estados viejos con `'data.csv'` y los migra a `'sheet'`.
- `tags` y `flag` existen en `Reading`; la UI solo marca el favorito. `deleted` es un tombstone heredado; la UI no borra.
- **Sync con Google Sheets:** `src/lib/state/sheetSync.svelte.ts` hace `fetch` del CSV publicado (`cache: 'no-store'`, timeout de 8 s y un parámetro `t` por intento para saltar el caché del CDN) al arrancar, al volver a la pestaña (`visibilitychange`), al recuperar red (`online`) y al tocar el refresh de la cabecera. La sync manual avisa con un toast "Hoja al día" si no hubo cambios y con el error si falló.
- La cabecera tiene tema claro/oscuro, refresh y Configuración. La sección Datos de Configuración ya no sincroniza: solo informa el estado, la última sync y el aviso de filas locales.
- **Merge** (`mergeSheetReadings`): clave `fecha|medicion`. La hoja manda en valor y nota; `flag` y `tags` locales se conservan. Las filas locales que no están en la hoja no se borran: se cuentan en `localOnly` y se avisan en Configuración.
- No hay semilla local: la app arranca con `readings: []` (`buildInitialState`). La hoja es la única fuente; IndexedDB es la caché de la última sync.
- La hoja viva arranca el 2026-09-20 08:40 con `73.000` y sigue con `74.780`, `76.350` y `77.950`, marcadas como `medicion simulada`; el 24 sep es `79.656`.
- La foto histórica de tests conserva los valores viejos de esos días: 20 sep `73.000`, 21 sep `74.635`, 22 sep `76.270`, 23 sep `77.905`. La hoja y el fixture no coinciden en esos tres decimales, y no hace falta que coincidan: el fixture es una foto congelada, no la hoja viva.
- Deduplicación por `fecha|medicion`.
- El parser tolera columnas extra de CSV viejos; la exportación es atómica.
- No hay importación desde la UI ni escritura en la hoja.
- No hay gist, token, backup JSON ni reset.

## Seguridad y privacidad

- No hay token ni cuenta. La app lee un CSV público con CORS: leer no necesita credenciales y escribir no está soportado.
- Nunca guardes un PAT en el repo, el estado, IndexedDB, `localStorage`, el CSV ni los logs.
- **La hoja publicada es pública:** las notas con nombres o direcciones quedan visibles para quien tenga el link.
- Para escribir en la hoja en el futuro haría falta OAuth de Google o un Apps Script/backend, no un PAT en la PWA.

## Lenguaje

- “aproximado”, “≈”, “normal”, “raro”, “posible”.
- Nada de centavos ni falsa precisión.
- La factura es una estimación; el recibo real manda.

## Archivos

- Implementación: `src/lib/domain/*.ts` (anomalies, backup, billing, constants, csv, cycles, dates, format, gaps, initialState, periods, projections, readings, stats, tariffs, types) y `src/lib/state/sheetSync.svelte.ts`.
- Tests: `src/lib/domain/*.test.ts` (86 casos), con la foto histórica de la ex semilla en `src/lib/domain/__fixtures__/mediciones.ts`.
- Estado inicial: `src/lib/domain/initialState.ts` (`buildInitialState()` con `readings: []`).
- Documentación de usuario: `instructions.md` (manual del repo; no se renderiza dentro de la app).
- UI: una sola página en `src/routes/Medidor.svelte` + `SettingsDialog`.
