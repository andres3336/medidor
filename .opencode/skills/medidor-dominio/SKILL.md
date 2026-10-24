---
name: Dominio Medidor AYA
description: Reglas normativas de facturación, ciclos, lecturas, fugas y CSV del Medidor AYA. Cargar antes de tocar src/lib/domain, data.csv o cualquier cálculo de dinero.
---

# Dominio Medidor AYA

Este skill es la verdad operativa del proyecto. Si el código y este documento difieren, gana el documento y hay que corregir el código con tests.

## Regla de oro

`data.csv` guarda **solo** `fecha,medicion,nota`. Consumo, Δ, litros, L/h, costos, proyecciones y outliers son derivados y se recalculan en memoria. Nunca los persistas ni los agregues como columnas.

## Unidades y formatos

- m³, consumo y medición: hasta 3 decimales.
- Litros: enteros.
- L/h: 1 decimal.
- Dinero: colones, sin centavos al mostrar. `Math.ceil` al colón.
- Números: punto decimal y coma de miles (`1,234.567`), como el CSV original.
- Fechas: ISO 8601 con offset `-06:00`; Costa Rica no tiene DST.

## Lecturas y consumo

```
exacto     = lectura_actual - base
facturable = floor(lectura_actual) - floor(base)
```

Si el facturable es negativo, se muestra 0 y se marca dato dudoso. Ejemplo canónico: base `100.283`, actual `103.077` → exacto `2.794`, facturable `3`.

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

## Ciclos

- Corte el día 20, configurable (1–28).
- Ciclo actual: `endAt === null`.
- El instante exacto del corte pertenece al ciclo **nuevo** (`start <= at < end`).
- Cierre manual y auditable: lectura final, consumo facturado, fecha/hora de corte, monto real y nota. Cada campo ajustado genera un `CycleAdjustment`.
- La lectura final ajustada pasa a ser `baseValue` del ciclo nuevo. No auto-cerrar, no inventar base.
- Semilla: ciclo 2026-09 base 73.000, cierre 2026-10-20 10:05 con lectura 100.283 (27 m³); ciclo 2026-10 actual base 100.283.

## Flujo y fugas

```
Δm³   = lectura_2 - lectura_1
horas = (fecha_2 - fecha_1) / 3600
L/h   = Δm³ × 1000 / horas
```

- Basal = percentil 10 de L/h positivos; con menos de 10 muestras, mínimo positivo.
- Nocturno = intervalos entre 22:00 y 06:00.
- Pérdida mensual = basal × 24 × 30 / 1000 m³.
- Costo = factura(consumo + pérdida) - factura(consumo).
- Amarillo ≥ 1 L/h, rojo ≥ 5 L/h (configurable). Nunca decir “fuga confirmada”.

## Notas vs medidor

- Cantidades: `6 litros`, `20L+5L+10L`; decimales sueltos con 3+ decimales (`0.004`) se leen como m³.
- `no_explicado = litros_medidor - litros_nota`; con más de 2 L se genera señal.
- Si la nota dice que el medidor sigue girando, marcar flujo continuo aunque no haya cantidad.
- Casos canónicos: 23 L medidos − 6 L de nota = 17 L ≈ 15.7 L/h; 799 L − 35 L = 764 L; 4 L/h con casa sin uso.

## Serie diaria y outliers

- L/día por intervalo normalizado: última lectura del día contra la última del día anterior **con datos**, dividido por las horas reales. Los huecos no generan picos.
- Base normal: mediana de los últimos 14 días (configurable), banda p25–p75, descartando outliers.
- Outlier: `valor > max(mediana × 2, mediana + 3×MAD)`. Con menos de 5 días, baseline insuficiente y se usa el promedio del ciclo como referencia.
- Equivalencia: “N días normales en uno” = valor / mediana.

## Lenguaje

- “aproximado”, “≈”, “normal”, “raro”, “posible”.
- Nada de centavos ni falsa precisión.
- La factura es referencia secundaria; el número principal es la anomalía de ayer.

## Archivos

- Implementación: `src/lib/domain/*.ts` (types, dates, format, tariffs, billing, cycles, readings, flow, stats, anomalies, notes, projections, gaps, csv, summary, settings, seed).
- Tests: `src/lib/domain/*.test.ts`.
- Semilla: `data.csv` en la raíz, importado con `?raw`.
- Documentación de usuario: `instructions.md`.
