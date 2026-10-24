# Medidor AYA — Plan de implementación

> **Nota de vigencia (2026-10-24):** este documento conserva el plan original. El rediseño implementado —una sola página, ciclos derivados 20 → 20, sin gist ni cierre manual— está descrito en `README.md`, `instructions.md` y `AGENTS.md`. Las secciones que quedaron obsoletas están listadas en `docs/planning-errata.md`.

**Estado:** aprobado para construir  
**Fecha:** 2026-10-24  
**Repo:** `/root/projects/medidor`  
**Deploy:** GitHub Pages (PWA)  
**UI:** español (es-CR)  
**Stack:** Svelte 5 + Vite + TypeScript

---

## 1. Objetivo

App personal, rápida y offline-first para **detectar anomalías de consumo y actuar rápido**, no para clavar la factura al colón.

Prioridad:

1. **Radar diario:** “ayer se consumió X L; normalmente son Y L/día; esto es N× lo normal”.
2. **Detección de picos y fugas:** L/h, flujo basal, días raros, comparación día contra día.
3. **Conclusiones accionables:** “se consumió lo de una semana en un día”, “el costo de ayer duplicó al anterior”, “revisá llave-ducha / casa2”.
4. **Estimado de factura:** referencia para presupuestar, con redondeo hacia arriba; no es el objetivo principal.
5. **Registro y backup:** lecturas, notas, flags, CSV y gist.

No es una app multi-usuario, no es un cliente de chat y no reemplaza la factura oficial de AYA.

### 1.1 Enfoque: anomalías y acción

La factura es una **estimación**; la fuente de verdad es AYA. La app tiene que responder rápido:

- ¿El consumo de ayer fue normal?
- ¿Cuánto se desvía de la mediana?
- ¿A cuántos “días normales” equivale?
- ¿El costo aproximado subió o bajó vs el día anterior?
- ¿Hay flujo continuo (posible fuga)?
- ¿Qué llave/casa/nota puede explicarlo?
- ¿Qué hago ahora?

**Reglas de lenguaje:**

- Usar “aproximado”, “≈”, “normal”, “raro”, “posible”.
- Nada de centavos ni falsa precisión.
- Ejemplos de tarjetas:
  - “Ayer: 1,517 L — 5.2× tu mediana de 290 L/día.”
  - “Equivale a 5 días normales en uno.”
  - “Costo aproximado de ayer: ₡1,325; el día anterior: ₡397 (3.3×).”
  - “Flujo basal 4 L/h ≈ 2.9 m³/mes ≈ ₡2,500/mes si sigue igual.”
  - “Revisá llave-ducha en casa2; el patrón se parece al 11/10.”

---

## 2. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Idioma | Español (es-CR) en UI e instrucciones; código en inglés |
| Framework | Svelte 5 + Vite + TypeScript |
| Deploy | GitHub Pages, hash routing (`#/hoy`) |
| Persistencia | IndexedDB local + gist público de GitHub |
| Gist | `medidor.md` (estado/resumen) + `data.csv` (único CSV) |
| Fuente de datos | `data.csv` local; única fuente de lecturas; se sube al gist como CSV |
| CSV atómico | Solo `fecha,medicion,nota`; `consumo`, `diff`, L, L/h y costos se calculan en la app |
| Chat | Sin chat interno; descargar `data.csv` y copiar/descargar `resumen.md` |
| Redondeo AYA | Truncar cada lectura a m³ enteros |
| Ciclo | Día 20 de cada mes, configurable; cierre manual con ajuste de lectura/base |
| Tarifas | ARESEP vigentes al 2026-10-23, editables |
| IVA | 13% sobre **todo el acueducto** si el consumo facturable > 30 m³ |
| Decimales | m³/consumo/medición: 3; litros: 0; L/h: 1; precios: 0 |
| Dinero | CRC; total redondeado hacia arriba al colón |
| Flags | Swipe derecha en móvil; estrella en desktop |
| Validación | Sin validadores pesados; `data.csv` es la fuente confiable |
| Día sin lectura | Alerta roja bloqueante (“super error”) + ack + acceso a agregar lectura |

---

## 3. Cálculo real de la factura

> Esto es referencia para que el estimado sea razonable, no para obsesionarse con el monto exacto. El foco de la app es detectar anomalías.

### 3.1 Tarifas oficiales (₡ por m³)

Fuente: calculadora tarifaria de ARESEP, consultada el **2026-10-23** para AyA, categoría Residencial, con alcantarillado.

| Componente | 0–15 | 16–30 | 31–60 | 61+ | Cargo fijo |
|---|---:|---:|---:|---:|---:|
| Acueducto | 437 | 875 | 1,210 | 2,005 | 2,000 |
| Alcantarillado | 408 | 867 | 997 | 1,807 | 1,200 |
| Hidrantes | 23 | 24 | 26 | 30 | 0 |
| Protección recurso hídrico (TPRH) | 5 | 6 | 6 | 7 | 0 |
| **Combinada** | **873** | **1,772** | **2,239** | **3,849** | **3,200** |

La tabla combinada explica los números del `skill.md`:

- `873 = 437 + 408 + 23 + 5`
- `1,772 = 875 + 867 + 24 + 6`
- `2,239 = 1,210 + 997 + 26 + 6`
- `3,200 = 2,000 + 1,200`
- `2,397 ≈ 2,239 + (1,210 × 13%)` es solo el costo marginal del m³ 31.

### 3.2 Consumo

- **Consumo exacto:** `lectura_actual − base_ciclo` (3 decimales).
- **Consumo facturable:** `floor(lectura_actual) − floor(base_ciclo)` (m³ enteros).
- Si el resultado es negativo, mostrar 0 y marcar “dato dudoso”.

La app muestra siempre ambos: exacto para entender, facturable para estimar la factura.

### 3.3 Desglose

Con `consumo = consumo facturable`:

```text
unidades_bloque_1 = min(consumo, 15)
unidades_bloque_2 = max(0, min(consumo, 30) - 15)
unidades_bloque_3 = max(0, min(consumo, 60) - 30)
unidades_bloque_4 = max(0, consumo - 60)

acueducto     = suma(unidades × tarifa_acueducto) + 2,000
alcantarillado = suma(unidades × tarifa_alcantarillado) + 1,200
hidrantes     = suma(unidades × tarifa_hidrantes)
tprh          = suma(unidades × tarifa_tprh)

iva = consumo > 30 ? acueducto × 0.13 : 0

total = acueducto + iva + alcantarillado + hidrantes + tprh
```

**Regla clave:** el IVA no es solo sobre el bloque 3. Si el consumo supera 30 m³, el 13% se aplica a **todo el acueducto**, incluyendo los primeros 30 m³ y el cargo fijo de ₡2,000.

### 3.4 Ejemplos de validación

| Consumo facturable | Exacto de referencia | Total | IVA |
|---:|---:|---:|---:|
| 3 m³ | 2.794 | ₡5,819 | ₡0 |
| 15 m³ | — | ₡16,295 | ₡0 |
| 27 m³ | 27.283 | ₡37,559 | ₡0 |
| 30 m³ | — | ₡42,875 | ₡0 |
| 31 m³ | — | ₡48,089.70 | ₡2,975.70 |
| 40 m³ | — | ₡69,656.40 | ₡4,391.40 |
| 44 m³ | — | ₡79,241.60 | ₡5,020.60 |
| 60 m³ | — | ₡117,582.40 | ₡7,537.40 |
| 61 m³ | — | ₡121,692.05 | ₡7,798.05 |

**Salto 30 → 31 m³: +₡5,214.70.** La UI debe mostrar esta alerta de forma prominente cuando la proyección cruce los 30 m³.

### 3.5 Configuración de tarifas

Todo editable en Ajustes:

- 4 bloques por componente, cargos fijos, tasa de IVA (13%), umbral (30 m³).
- Toggles para incluir/excluir alcantarillado, hidrantes y TPRH.
- Botón “restaurar tarifas ARESEP 2026-10-23”.
- Campo de fecha/fuente de las tarifas.
- No se scrapea ARESEP en runtime; se actualiza manualmente.

### 3.6 Proyección

- Días transcurridos y restantes del ciclo.
- Tres escenarios:
  1. **Promedio del ciclo:** consumo exacto / días transcurridos.
  2. **Reciente:** promedio de los últimos 7 días.
  3. **Peor:** máximo L/día observado en el ciclo (normalizado por intervalo).
- `proyección = consumo_actual + tasa × días_restantes`.
- Facturable proyectado = `floor(lectura_proyectada) − floor(base)`.
- Mostrar:
  - factura a hoy (si el ciclo cerrara hoy),
  - factura esperada al cierre,
  - **peor escenario** redondeado hacia arriba,
  - m³ que faltan para 15 / 30 / 60,
  - fecha estimada de cruce de 30 m³,
  - salto de IVA si corresponde.
- La factura es una **referencia secundaria**. El número principal del dashboard es la anomalía del día (ayer vs normal), no el total del ciclo.
- El “peor escenario” se muestra como presupuesto conservador, pero no domina la pantalla.

### 3.6.1 Cierre de ciclo manual (día 20)

El monto final no es exacto: AYA puede redondear, ajustar o cortar en una fecha distinta. Por eso el cierre es **manual y auditable**, no automático.

**Flujo “Cerrar ciclo”** (disponible desde el día 20, o antes si el usuario quiere):

1. La app muestra la última lectura conocida y propone:
   - lectura final/base = última lectura;
   - fecha/hora de corte = día 20 a las 00:00 (editable);
   - consumo facturado = `floor(última) − floor(base anterior)` (editable).
2. El usuario puede ajustar:
   - **lectura final** (3 decimales) — la que usa AYA o la que el usuario decide;
   - **consumo facturado** (m³ enteros) — si AYA facturó otra cosa;
   - **monto real** de la factura (CRC) — opcional;
   - **fecha/hora de corte** — por si el trabajador pasó otro día;
   - **nota** del cierre.
3. Al confirmar:
   - se cierra el ciclo anterior (`endAt`, `closedAt`, `finalReading`, `billedM3`, `actualBill`);
   - se crea el ciclo nuevo con `baseValue` = lectura final ajustada y `startAt` = fecha/hora de corte;
   - se recalculan consumo, factura, proyección y gráficas;
   - se guarda una entrada de auditoría por cada campo ajustado.
4. Si no se cierra:
   - modal destacado al abrir el día 20 o después;
   - banner rojo persistente “Cierre de ciclo pendiente”;
   - no se auto-cierra ni se inventa una base;
   - la proyección sigue corriendo, pero marcada como “ciclo vencido”.
5. El usuario también puede editar la base del ciclo actual en Ajustes, con confirmación y auditoría.

**Auditoría:**

```ts
type CycleAdjustment = {
  at: string;
  field: "baseValue" | "finalReading" | "billedM3" | "actualBill" | "startAt";
  oldValue: number | string;
  newValue: number | string;
  reason: string;
};
```

Mostrar el historial en Ajustes → Ciclos y en `medidor.md`.

### 3.7 Fugas

Para cada par de lecturas consecutivas:

```text
Δm³  = lectura_2 − lectura_1
horas = (fecha_2 − fecha_1) / 3600
L/h   = Δm³ × 1000 / horas
```

- Si `horas <= 0`, mostrar “—”.
- `flujo basal` = percentil 10 de los L/h positivos (o el mínimo positivo si hay pocos datos).
- Mostrar mínimo observado, p10 y promedio nocturno (22:00–06:00).
- Pérdida mensual estimada = `flujo_basal × 24 × 30 / 1000` m³.
- Costo de fuga = `factura(consumo_actual + pérdida_mensual) − factura(consumo_actual)`.
- Badge amarillo si basal ≥ 1 L/h; rojo si ≥ 5 L/h (configurable).
- No afirmar “fuga confirmada”; etiquetar “flujo continuo sospechoso”.

**Nota vs medidor (clave para el caso del usuario):**

- Parsear cantidades en la nota: `6 litros`, `20L+5L+10L`, `0.023`, etc.
- `no_explicado = delta_m3 × 1000 − litros_de_la_nota`.
- `L/h_no_explicado = no_explicado / horas_del_intervalo`.
- Si `no_explicado > 0` y supera un umbral (default 2 L), mostrar:
  - “La nota explica 6 L, pero el medidor marcó 23 L → **17 L no explicados ≈ 15.7 L/h**”.
  - Acción: revisar `llave-ducha`, `llave-alfonso`, casa2 o el medidor.
- Si la nota dice “no hubo agua” o “el medidor sigue girando”, marcar flujo continuo aunque no haya cantidad.
- Esto **no** es un error; es una señal de fuga.
- Ejemplos del CSV actual:
  - fila 61 (10/23): 6 L de nota vs 23 L de medidor → 17 L no explicados;
  - fila 58 (10/21): 35 L almacenados vs 799 L de medidor → 764 L no explicados;
  - fila 40 (10/14): 4 L/h con la casa sin uso.

### 3.8 Outliers y conclusiones

- Calcular L/día por intervalo normalizado (no por día calendario crudo).
- Serie diaria: para cada día con lectura, `L/día = (última lectura del día − última lectura del día anterior con datos) × 1000 / días transcurridos`. Los huecos se normalizan y se marcan; no generan picos falsos.
- **Base normal:** mediana de L/día de los últimos 14 días (excluyendo outliers), más banda p25–p75. Si hay menos de 5 días, mostrar “baseline insuficiente” y usar el promedio del ciclo como referencia provisional.
- **Outlier diario:** `valor > max(mediana × 2, mediana + 3×MAD)` (configurable).
- **Outlier de flujo:** L/h > umbral (default 10 L/h) o flujo basal ≥ 1 L/h.
- Para cada outlier, generar una tarjeta en lenguaje natural:
  - multiplicador vs mediana: “5.2× lo normal”;
  - equivalencia: “5 días normales en uno”;
  - costo aproximado del día y comparación con el día anterior;
  - nota/flags cercanos;
  - acción sugerida (“revisá llave-ducha”, “revisá casa2”, “el medidor sigue girando”).
- **Costo diario aproximado:** `Δm³ × tarifa marginal combinada del bloque actual` (sin cargo fijo). Si el ciclo está sobre 30 m³, sumar el IVA marginal de `1,210 × 13%`. Etiquetar “aproximado”.
- **Comparación día contra día:** `% = (hoy − ayer) / ayer`; mostrar “duplicó”, “bajó 40%”, etc.
- No bloquear nada; es un radar, no un validador.

---

## 4. Modelo de datos

### 4.1 Reading

```ts
type Reading = {
  id: string;              // UUID
  at: string;              // ISO 8601 con offset -06:00
  value: number;           // m³, 3 decimales
  note: string;
  tags: string[];          // diaria, semanal, incidente, ajuste,
                           // llave-medidor, llave-alfonso, llave-ducha,
                           // casa1, casa2...
  flag: boolean;
  source?: "data.csv" | "app";
  createdAt: string;
  updatedAt: string;
  deleted: boolean;        // tombstone para sync
};
```

### 4.2 Cycle

```ts
type Cycle = {
  id: string;              // "2026-10"
  label: string;           // "20 oct – 20 nov"
  startAt: string;
  endAt: string | null;    // null = ciclo actual
  baseValue: number;       // lectura de corte exacta (editable al cerrar)
  closedAt: string | null;
  finalReading?: number;   // lectura final ajustada manualmente
  billedM3?: number;       // consumo que facturó AYA (editable)
  actualBill?: {
    total: number;
    billedM3: number;
    paidAt: string;
    note?: string;
  };
  adjustments: CycleAdjustment[];
};

type CycleAdjustment = {
  at: string;
  field: "baseValue" | "finalReading" | "billedM3" | "actualBill" | "startAt";
  oldValue: number | string;
  newValue: number | string;
  reason: string;
};
```

### 4.3 Settings

```ts
type Settings = {
  cycleDay: number;                    // 20
  timezone: "America/Costa_Rica";
  billingRounding: "floor-reading";    // default
  currency: "CRC";
  decimals: { m3: 3; liters: 0; flow: 1; money: 0 };
  tariffs: {
    blocks: [
      { upTo: 15,    acueducto: 437,  alcantarillado: 408,  hidrantes: 23, tprh: 5 },
      { upTo: 30,    acueducto: 875,  alcantarillado: 867,  hidrantes: 24, tprh: 6 },
      { upTo: 60,    acueducto: 1210, alcantarillado: 997,  hidrantes: 26, tprh: 6 },
      { upTo: null,  acueducto: 2005, alcantarillado: 1807, hidrantes: 30, tprh: 7 }
    ];
    fixed: { acueducto: 2000; alcantarillado: 1200; hidrantes: 0; tprh: 0 };
    iva: { rate: 0.13; thresholdM3: 30; appliesTo: "acueducto"; onTotal: true };
    include: { alcantarillado: true; hidrantes: true; tprh: true };
  };
  projection: {
    method: "worst";                   // worst | expected | both
    safetyMarginPct: 0;                // opcional
    useMaxDaily: true;
  };
  gapWarnHours: 36;
  acknowledgedGaps: string[];
  theme: "auto" | "light" | "dark";
  gist: {
    id: string | null;
    url: string | null;
    lastSyncAt: string | null;
  };
};
```

El token del gist **no** vive en `Settings` ni en el gist; va en `localStorage`.

### 4.4 Derivados

No se guardan como fuente de verdad:

- `consumo exacto`, `consumo facturable`, `Δm³`, `litros`, `horas`, `L/h`,
- `L/día` por intervalo, `flujo basal`, `outliers`,
- desglose de factura, IVA, total,
- proyecciones y fechas de cruce.

Se recalculan en memoria. El `data.csv` del gist mantiene solo las 3 columnas atómicas (`fecha,medicion,nota`); si hace falta una exportación enriquecida para el chat, se genera aparte sin cambiar el CSV canónico.

---

## 5. Almacenamiento y sync

### 5.1 Local

- **IndexedDB** (base `medidor`, store `state`) con el estado completo.
- Al abrir: leer IDB; si está vacío, cargar `data.csv` empaquetado.
- Solicitar `navigator.storage.persist()` en el primer guardado.
- `localStorage` solo para: token del gist, último gist ID, preferencias de UI no críticas.
- Export/import JSON completo para backup manual.

### 5.2 Gist público

Dos archivos:

1. `medidor.md`
   - README humano + resumen del ciclo actual.
   - Bloque de estado entre marcadores:

   ````md
   <!-- MEDIDOR_STATE_START -->
   ```json
   {
     "schema": 1,
     "updatedAt": "2026-10-24T...",
     "settings": { ... },
     "cycles": [ ... ],
     "readingMeta": {
       "2026-10-23T09:20:00-06:00|103.077": {
         "flag": true,
         "tags": ["incidente", "llave-ducha"]
       }
     },
     "deletedReadings": []
   }
   ```
   <!-- MEDIDOR_STATE_END -->
   ````

2. `data.csv`
   - El único CSV y la fuente de lecturas.
   - Solo columnas atómicas:

   ```text
   fecha,medicion,nota
   ```

   - `fecha` en el formato original (`MM/DD/YYYY hh:mm AM/PM`) o ISO 8601; la app acepta ambos.
   - `medicion` con 3 decimales.
   - `nota` entre comillas, admite comas y saltos de línea.
   - **No se guardan** `consumo`, `diff`, litros, L/h ni costos: son derivados y pueden cambiar si cambia la lógica.
   - No hay columnas de flags/tags en el CSV: esos metadatos viven en `medidor.md`.

No hay `medidor.json` separado: los ajustes, ciclos, flags y tags viven en el bloque JSON de `medidor.md`; las lecturas viven en `data.csv`.

### 5.3 Autenticación

- PAT **fine-grained** con permiso `Gists: write` (verificado que funciona).
- Se guarda en `localStorage`; nunca se escribe en el repo ni en el gist.
- El usuario puede crear un gist nuevo desde Ajustes o pegar uno existente.
- Botones: “Probar conexión”, “Sincronizar ahora”, “Olvidar token”.
- Mostrar URL del gist y URL raw del CSV/MD para compartir con el chat.

### 5.4 Sync

- Al abrir y al volver a la pestaña: pull del gist si hay token.
- Al editar: guardar local inmediatamente; push debounced ~2 s.
- Pull + merge:
  - readings por clave `fecha|medicion`; las nuevas se agregan y las existentes se mantienen/actualizan.
  - settings, cycles, flags, tags y `deletedReadings` viven en `medidor.md` con un `updatedAt` global; si hay conflicto, gana el estado más reciente y se muestra un toast.
- Push:
  - fetch del gist actual, merge, PATCH de ambos archivos.
  - si falla, reintentar con backoff y dejar pendiente en IDB.
- Offline: la app funciona completa; mostrar “sin sync” y contador de cambios pendientes.
- `medidor.md` se regenera con el resumen del ciclo actual; `data.csv` se regenera desde las lecturas.

### 5.5 Privacidad

- Gist **público** por decisión del usuario; el link es compartible.
- No se suben tokens ni datos de sesión.
- Las notas pueden contener nombres; el usuario aceptó el riesgo.
- Opción futura: gist secreto (el raw URL sigue funcionando para el chat).

---

## 6. Carga inicial desde `data.csv`

- `data.csv` es la única fuente de lecturas y se empaqueta con la app.
- Al primer arranque, si IndexedDB está vacío:
  - parsear `data.csv` (solo `fecha,medicion,nota`);
  - asignar lecturas a ciclos por fecha usando los ciclos configurados;
  - deduplicar por `fecha|medicion`;
  - cargar settings, ciclos y lecturas;
  - calcular `consumo`, `diff`, L y L/h en memoria;
  - mostrar un resumen de importación (filas, rango, ciclos).
- Datos conocidos:
  - Ciclo anterior: base `73.000`, inicio `2026-09-20`, cierre `2026-10-20 10:05`, lectura `100.283`.
  - Ciclo actual: base `100.283`, inicio `2026-10-20 10:05`, fin `2026-11-20 00:00`.
- Los ciclos iniciales van en `settings`/seed; no se infieren de columnas calculadas.
- No hay fetch externo ni script de importación.
- Import manual adicional: archivo `data.csv` o JSON desde Ajustes.
- `data.csv` corregido: **60 filas**, sin duplicados, solo `fecha,medicion,nota`.
- La app es tolerante: si aparece un timestamp duplicado o una lectura rara, lo muestra con un badge suave. No genera reportes ni archivos de corrección.

### 6.1 Señales de fuga desde las notas

La app usa las notas para detectar fugas, no para corregir filas.

| Señal | Cálculo | Ejemplo |
|---|---|---|
| Nota dice menos de lo que marcó el medidor | `no_explicado = delta − cantidad_nota`; `L/h = no_explicado / horas` | 23 L − 6 L = 17 L ≈ 15.7 L/h |
| Nota no explica el consumo del día | `no_explicado = delta − suma_cantidades_nota` | 799 L − 35 L = 764 L |
| Nota dice que el medidor sigue girando | Marcar flujo continuo y estimar L/h | 4 L/h con casa sin uso |
| Flujo basal positivo | p10 de L/h positivos | — |

- Si `no_explicado > 2 L`, mostrar “posible fuga” con la acción sugerida (`llave-ducha`, `llave-alfonso`, casa2).
- Si la nota dice “no hubo agua” o “sigue dando vueltas”, marcar flujo continuo aunque no haya cantidad.
- Esto va a la tarjeta de fuga/radar, no a una pantalla de errores.

---

## 7. Pantallas

| Ruta | Pantalla | Contenido |
|---|---|---|
| `#/hoy` | Hoy | **Ayer vs normal**, radar 7 días, costo diario aproximado, fuga, factura estimada (secundaria), alerta de IVA, cierre de ciclo pendiente, días faltantes, quick add, sync |
| `#/lecturas` | Lecturas | Tabla/cards, búsqueda, filtros, flags, edición, borrado con undo, CSV, resumen Markdown |
| `#/graficas` | Gráficas | L/día con banda normal, costo diario, acumulado vs proyección, L/h con flujo basal, historial |
| `#/analisis` | Análisis | Conclusiones automáticas, outliers, fuga, comparación día/semana/periodo, what-if, historial |
| `#/ajustes` | Ajustes | Cierre de ciclo/base, tarifas, IVA, redondeo, proyección, gist, import/export, tema, borrar data |
| `#/instrucciones` | Instrucciones | `instructions.md` renderizado + glosario + fórmulas + privacidad |

Navegación inferior móvil con 5 ítems; Instrucciones dentro de Ajustes o “Más”.

### 7.1 Hoy

**Hero: “Ayer / últimas 24 h”** — el foco de la pantalla.

- Si no hay lectura de ayer, usar el último intervalo completo y etiquetarlo “últimas X h”; no inventar un día.
- Litros consumidos.
- Comparación con la mediana normal: “5.2× lo normal”.
- Equivalencia: “5 días normales en uno”.
- Costo aproximado del día vs día anterior: “ayer ₡1,325; anteayer ₡397 (3.3×)”.
- Semáforo: normal / ojo / raro.
- Botones: “Ver detalle”, “Marcar incidente”, “Agregar lectura”.

**Tarjeta “Radar 7 días”**

- Mini-barras de los últimos 7 días con banda normal.
- Picos, flujo basal y días sin lectura.
- Acción sugerida según patrón y notas: “revisá llave-ducha casa2”.

**Tarjeta “Factura estimada”** — secundaria, colapsable.

- Factura a hoy, esperada y peor escenario.
- Desglose (acueducto, alcantarillado, hidrantes, TPRH, IVA).
- Alerta “si cruzás 30 m³, el IVA sube ~₡5,215”.
- Texto: “Estimación; el recibo real manda”.

**Tarjeta “Fuga”**

- Basal L/h, mínimo, nocturno.
- Pérdida m³/mes y costo aproximado.
- “Si sigue igual” vs “si la arreglás”.

**Resto**

- Botón sticky “Agregar lectura”.
- **Banner rojo “Cierre de ciclo pendiente”** desde el día 20: “Ajustá la lectura final/base”.
- Banner/modal de días faltantes (super error).
- Indicador de sync.

### 7.2 Lecturas

- Vista tabla en desktop, cards en móvil.
- Columnas: fecha, medición, consumo del ciclo, Δ litros, Δ horas, L/h, nota, tags, flag.
- Orden por fecha; badge “mismo minuto” si hay timestamps duplicados.
- Filtros: ciclo, tag, solo flags, solo outliers, rango de fechas.
- Swipe derecha para flag; estrella en desktop.
- Editar/borrar con confirmación y “Deshacer” (5 s).
- Descargar `data.csv`; copiar/descargar `resumen.md`.
- Quick add: fecha/hora actual editable, medición numérica (acepta `.` o `,`), nota, tags sugeridos, flag.

### 7.3 Gráficas

- **L/día:** barras por intervalo normalizado; banda de mediana/p25–p75; outliers en color; tooltip con L totales, horas, nota; clic abre lectura.
- **Costo aproximado por día:** barras o línea; comparación día contra día; sin cargo fijo; etiqueta “≈”.
- **Acumulado del ciclo:** línea de m³, umbrales 15/30/60, zona de IVA >30 sombreada, proyección punteada, marcador de hoy; tooltip con factura estimada.
- **L/h:** línea/scatter, escala log opcional, línea de flujo basal, sombra nocturna, outliers.
- **Historial de ciclos:** barras de m³ por ciclo, etiqueta de factura; toggle m³/CRC.
- Selector 7d / 30d / ciclo / todo.
- Chart.js con import dinámico solo en esta ruta (o SVG propio si el peso molesta).

### 7.4 Análisis

- Fuga: basal, mínimo, nocturno, pérdida mensual, costo, comparación entre periodos.
- Outliers: lista con fecha, L/día, L/h, multiplicador vs mediana, equivalencia en días normales, costo aproximado, nota y flag.
- **Conclusiones automáticas:** tarjetas en lenguaje natural (“el 15/10 se consumió lo de una semana”, “el flujo basal subió desde…”, “el costo diario se duplicó…”).
- **Comparación día contra día / semana contra semana:** variación porcentual y en litros.
- Comparación por periodo/tag (ej. “casa2 lavó” vs “sin casa2”).
- What-if: slider de cambio de consumo diario o arreglo de fuga; factura resultante.
- Historial de ciclos: exacto, facturable, desglose, factura real (opcional), diferencia.
- Calibración: registrar factura real y comparar; no auto-ajustar tarifas. La factura es una estimación.

### 7.5 Ajustes

- **Cierre de ciclo:** última lectura, lectura final/base, consumo facturado, monto real, fecha/hora y nota. Historial de ajustes.
- Ciclo actual: base editable, fecha/hora de corte, “cerrar ciclo” y “nuevo ciclo” con confirmación.
- Tarifas: tabla editable por bloque/componente; cargos fijos; IVA; incluir/excluir; restaurar ARESEP.
- Redondeo: truncar lectura (default) / exacto (solo comparación).
- Proyección: método, margen, usar máximo diario.
- Días faltantes: umbral de horas y severidad de la alerta.
- Gist: ID/URL, token, probar, sync, crear gist, olvidar token.
- Datos: importar CSV/JSON, exportar CSV/JSON, borrar datos locales.
- Tema.
- Formatos y zona horaria (solo lectura).

### 7.6 Instrucciones

Archivo `instructions.md` en el repo, renderizado en la app:

- Qué es y qué no es.
- Cómo agregar una lectura.
- Ciclo, corte y base.
- Fórmula real y tabla de tarifas.
- Exacto vs facturable.
- El salto de IVA a los 30 m³.
- Fugas: L/h, flujo basal, costo.
- Gráficas y outliers.
- Cierre de ciclo manual y ajuste de lectura/base.
- “Super error” de días sin lectura.
- Flags, notas y tags.
- CSV/Markdown para chat.
- Gist, backup y privacidad.
- Glosario.
- Limitaciones.

### 7.7 Resumen para chat

Generar `resumen.md`:

```md
# Medidor AYA — resumen para análisis

## Configuración
- Ciclo: 2026-10-20 10:05 → 2026-11-20 00:00
- Base: 100.283 m³
- Cierre anterior: 2026-10-20 10:05 (lectura final ajustada: 100.283)
- Cierre pendiente: no
- Redondeo: floor de cada lectura
- Tarifas: ARESEP 2026-10-23
- IVA: 13% sobre acueducto total si consumo > 30 m³

## Resumen
- Última lectura: 103.077 m³ (2026-10-23 09:20)
- Consumo exacto: 2.794 m³
- Consumo facturable: 3 m³
- Consumo de ayer: ... L (≈ N× la mediana de ... L/día)
- Costo aproximado de ayer: ₡... (vs ₡... el día anterior)
- Flujo basal: ... L/h
- Alerta: ...

## Anomalías y conclusiones
- ...
- ...

## Señales de fuga
- Fila 61: nota 6 L vs medidor 23 L → 17 L no explicados ≈ 15.7 L/h.
- Fila 58: nota 35 L vs medidor 799 L → 764 L no explicados.
- Flujo basal: ... L/h.

## Factura estimada
- A hoy: ₡5,819
- Esperada al cierre: ₡...
- Peor escenario: ₡...
- Nota: estimación; el recibo real manda.

## Desglose de factura
| Componente | Monto |
...

## Lecturas
| fecha | medicion | consumo | litros | L/h | nota |
...

## Notas y flags
...
```

Botones: “Copiar resumen”, “Descargar resumen.md”, “Descargar data.csv”.

---

## 8. Días faltantes: “super error”

- Detectar días calendario sin lectura dentro del ciclo actual.
- También alertar si la última lectura tiene más de `gapWarnHours` (default 36 h).
- **Alerta roja bloqueante** al abrir (`role="alertdialog"`), con:
  - título “ALERTA: no hay lectura de ayer” o “Sin lectura desde hace N días”;
  - lista de días/huecos;
  - “Agregar lectura ahora”;
  - “Ya revisé, continuar” (ack por hueco/ciclo).
- No se cierra clickeando afuera; hay que elegir una acción.
- Vibración corta en móvil (`navigator.vibrate`) si está disponible; sin sonido.
- Banner rojo persistente en Hoy hasta resolver o ack.
- Contador “días sin revisar”.
- Configurable a 2–3 días si se vuelve al ritmo del `skill.md`.
- Opcional futuro: notificación local diaria si la PWA está instalada. No en v1.

---

## 9. PWA, deploy y performance

- `vite-plugin-pwa` con precache del app shell, manifest e iconos.
- Manifest: “Medidor AYA”, display standalone, start_url `./`, scope `./`.
- Service worker: prompt de actualización; no perder formularios.
- Instalación: banner opcional; instrucciones iOS en Ajustes.
- Offline: app completa; datos en IDB; sync pendiente.
- GitHub Actions: `npm ci` → `npm test` → `npm run build` → deploy a Pages.
- `base: './'` + hash routing para funcionar en `usuario.github.io/medidor/`.
- Sin fuentes externas, CDN, analytics ni imágenes pesadas.
- Chart.js/PapaParse/snarkdown con import dinámico.
- Objetivo: <100 KB JS inicial gzip, Lighthouse 95+.
- Accesibilidad: contraste, foco, teclado, `prefers-reduced-motion`, targets 44 px.

---

## 10. Tests

Vitest para dominio:

- Parseo de fechas `MM/DD/YYYY hh:mm AM/PM` en `America/Costa_Rica`.
- CSV con notas entre comillas, comas y saltos de línea.
- Asignación de lecturas a ciclos por fecha y reset manual.
- Facturación en 0, 3, 15, 15.999, 16, 27, 30, 30.999, 31, 40, 60, 61.
- IVA: 30 vs 31; 31 → ₡2,975.70; total ₡48,089.70.
- Floor de lecturas: base 100.283 / actual 103.077 → 3 facturable; exacto 2.794.
- Proyecciones y detección del salto de IVA.
- L/h, flujo basal, outliers.
- Mediana/p25–p75 y multiplicador vs normal.
- Equivalencia “N días normales” y costo diario aproximado.
- Comparación día contra día (porcentaje y multiplicador).
- Generación de conclusiones en lenguaje natural.
- Cierre de ciclo: ajuste de lectura final/base, `billedM3`, fecha de corte y auditoría.
- Carga de `data.csv`: 60 filas, sin duplicados, solo `fecha,medicion,nota`; derivados calculados en memoria.
- Parseo de cantidades en notas (`6 litros`, `20L+5L+10L`).
- Nota vs medidor (fuga):
  - 23 L − 6 L = 17 L ≈ 15.7 L/h;
  - 799 L − 35 L = 764 L;
  - 4 L/h con casa sin uso.
- Detección de días faltantes y severidad de la alerta.
- Round-trip CSV/JSON con tombstones.
- Merge de dos estados.

Fixture: `data.csv` con resultados esperados (27 m³ → ₡37,559; 3 m³ → ₡5,819).

Opcional: Playwright smoke (agregar lectura, recargar, persistir, exportar).

---

## 11. Fases

1. **Scaffold**
   - Vite + Svelte 5 + TS.
   - Layout, navegación, tema, PWA, workflow de Pages.
2. **Dominio**
   - Tipos, fechas, números, tarifas, facturación, ciclos, proyecciones, fugas, outliers.
   - Baseline (mediana/p25–p75), comparación día contra día y generador de conclusiones.
   - Cierre de ciclo manual, ajustes y auditoría.
   - Carga inicial desde `data.csv`.
   - Tests.
3. **UI core**
   - Hoy, Lecturas, quick add, edición, flags, cierre de ciclo, super error de días faltantes, CSV/Markdown.
4. **Gráficas y análisis**
   - Charts, radar 7 días, conclusiones, outlier list, fuga, comparaciones, what-if, historial.
5. **Persistencia y sync**
   - IndexedDB, gist create/pull/push/merge, ajustes, backup/restore, offline/install.
6. **Pulido**
   - Instrucciones, glosario, accesibilidad, performance, tests finales, deploy.

---

## 12. Fuera de alcance (v1)

- Chat/LLM dentro de la app.
- Multiusuario, auth, roles.
- Validadores pesados o limpieza automática de datos.
- Precisión contable al centavo: la factura es una estimación y el recibo real manda.
- Cifrado del gist con passphrase.
- Scraping automático de tarifas ARESEP.
- App nativa.

---

## 13. Supuestos y pendientes

- El gist tendrá `medidor.md` + `data.csv`; no habrá `medidor.json` separado.
- `data.csv` es la única fuente de lecturas; 60 filas, sin duplicados, solo `fecha,medicion,nota`.
- Las tarifas son las de ARESEP al 2026-10-23; si cambian, se editan en Ajustes.
- El recibo incluye alcantarillado (confirmado por `873 = 437 + 408 + 23 + 5`); se puede desactivar.
- Zona horaria `America/Costa_Rica` (UTC-6, sin DST).
- Formato numérico con punto decimal y coma de miles (`1,234.567`), como el CSV original.
- Gist público por decisión del usuario.
- El ciclo actual empieza el 2026-10-20 10:05 con base 100.283; el anterior con base 73.000.
- La “final medición” es la base del ciclo actual, editable en Ajustes.
- El cierre de ciclo es manual cada 20; la app no auto-cierra ni inventa una base.
- El foco del producto es detectar anomalías y actuar; la factura es una referencia.
- La “normalidad” se calcula con la mediana de los últimos 14 días (ventana configurable).

---

## 14. Glosario

| Término | Significado |
|---|---|
| Medidor | Contador de agua; la lectura se escribe en m³ |
| Lectura / medición | Número del medidor en un momento dado |
| Consumo | Diferencia entre lectura actual y base del ciclo |
| m³ | Metro cúbico = 1,000 litros |
| L/h | Litros por hora; mide flujo entre dos lecturas |
| Ciclo | Periodo de facturación; acá va del 20 al 20 |
| Corte | Lectura de cierre/inicio de ciclo |
| Base | Lectura de referencia del ciclo actual |
| Bloque | Tramo de consumo con tarifa propia |
| Cargo fijo | Cobro mensual independiente del consumo |
| Acueducto | Componente de agua potable |
| Alcantarillado | Componente de aguas residuales |
| Hidrantes | Componente de hidrantes |
| TPRH | Tarifa de protección del recurso hídrico |
| IVA | Impuesto de valor agregado (13%) |
| Fuga | Flujo continuo no explicado por consumo normal |
| Llave-medidor | Llave general de entrada |
| Llave-alfonso | Restricción de Casa 2 |
| Llave-ducha | Punto crítico del inquilino |
| Casa 1 / Casa 2 | Sectores del inmueble |
| Flag | Marca personal para revisar una lectura |
| Outlier | Valor atípico frente al comportamiento normal |
| Gist | Archivo/DB remota de GitHub |
| PWA | App web instalable y offline |

---

## 15. Fuentes

- CSV de lecturas del usuario (`data.csv`, 60 filas, 2026-09-24 → 2026-10-23).
- `skill.md` del usuario (contexto; corregido en el alcance del IVA).
- ARESEP, Calculadora Tarifaria de Agua: https://aresep.go.cr/agua-potable/calculadora-tarifaria/ (consulta 2026-10-23).
- Ley 9635, artículo 8, inciso 12: IVA residencial exento hasta 30 m³; si se excede, se aplica al total de m³ consumidos.
- GitHub REST API, gists y CORS (verificado).
