# Instrucciones

## Qué es

Medidor AYA es una app personal para leer lo que marca el medidor de agua y el consumo del ciclo de facturación. Las mediciones se editan en una **hoja de Google Sheets publicada**; la app solo lee esa hoja. La app **estima** la factura; el recibo real de AYA manda.

Tiene una sola pantalla. De arriba hacia abajo encontrás:

1. **Ciclo actual**
2. **Gráficas**
3. **Mediciones** (tabla cruda)

En la cabecera hay tres botones a la derecha: el **sol/luna** cambia entre tema claro y oscuro, la **flecha circular** vuelve a bajar la hoja de Google Sheets y el **engranaje** abre **Configuración**. No hay otras pantallas ni menú inferior.

La app **no trae mediciones de fábrica**. En una instalación nueva la pantalla muestra **Todavía no hay mediciones** con el estado del sync y el botón **Sincronizar hoja**. Hasta que sincronices una vez, no se muestran las tarjetas de ciclo, las gráficas ni la tabla.

## Medición y consumo

La **medición** es el número que marca el medidor. El **consumo** es la diferencia entre dos mediciones, o entre la medición actual y la base del ciclo.

Ejemplo con la última medición de la hoja (24-OCT):

- Base del ciclo: `100.156 m³`.
- Lectura anterior: `103.910 m³`.
- Consumo exacto: `3.754 m³`.
- Consumo facturable: `3 m³`, porque AYA trunca cada medición a m³ enteros antes de restar.

## Cómo agregar o editar una medición

La app **no agrega ni edita** mediciones. El alta y la corrección se hacen en la hoja de Google Sheets; después sincronizás.

1. Abrí la hoja publicada desde el teléfono o la computadora.
2. Agregá una fila al final con tres columnas: `fecha`, `medicion` y `nota`.
   - `fecha`: `24/10/2026 09:17` o el formato que ya usa la hoja. La app también entiende ISO 8601.
   - `medicion`: el número del medidor, por ejemplo `103.910`.
   - `nota`: texto libre, por ejemplo “medicion diaria”.
3. Guardá la hoja.
4. En la app, tocá la **flecha circular** de la cabecera. También se sincroniza sola al abrir, al volver a la pestaña y al recuperar red.

La app mezcla por `fecha|medicion`:

- Si la fila es nueva, aparece en la tabla.
- Si la fecha y la medición ya existen, la nota y el valor de la hoja mandan.
- Los **favoritos** son locales y se conservan.
- Si una fila local no está en la hoja, **no se borra**: la app avisa “N filas locales no están en la hoja”. Copiala a la hoja para verla en todos los dispositivos.
- No hay botón de borrar. Las mediciones se corrigen en la hoja.

No hay token ni cuenta de Google: la app lee el CSV publicado, que es de solo lectura.

> La hoja publicada es pública. Quien tenga el link puede leer las notas, incluidos nombres o direcciones. No escribas ahí nada que no quieras compartir.

## El ciclo 20 → 20

El ciclo va del día 20 a las 00:00 al día 20 del mes siguiente. El día de corte es fijo; no se configura.

**La base se calcula sola.** Es la última medición anterior al día 20 a las 00:00. Si no existe —por ejemplo, en el primer ciclo— se usa la primera medición del ciclo. Si corregís esa medición en la hoja, la base cambia y todo se recalcula al sincronizar. No hay cierre manual ni base editable.

Ciclo actual con la hoja al 24-OCT:

- Ciclo `2026-10`, del 20 de octubre al 20 de noviembre.
- Base: `100.156 m³`, del 19-OCT a las 21:50.
- Lectura anterior: `103.910 m³`, del 24-OCT a las 09:17.

Las fechas se muestran siempre en **DD-MMM** mayúscula: `20-OCT`, `24-SEP`, `20-NOV`. La tabla agrega la hora con AM/PM.

La tarjeta del ciclo muestra:

- **Ciclo actual** en la cabecera. No muestra el `YYYY-MM` ni el rango de fechas.
- **CONSUMO** en m³ exactos y la proyección `≈ 22 m³ al cierre`.
- **LECTURA ANT** con la última medición y el promedio diario del ciclo anterior, por ejemplo `≈ 0.91 m³/día`. Si no hay medición de hoy, aparece **“FALTA la de hoy”**.
- **FACTURA APROX.** con `≈ ₡5,819`; es una estimación para presupuestar, no el recibo de AYA.
- **PROMEDIO** con el promedio diario actual (`0.83 m³/día`) y, debajo, el del ciclo anterior y la diferencia (`Anterior 0.91 · -0.07 m³/día`). Si bajó se muestra en verde; si subió, en ámbar.
- Barra de 0 a 60 m³ con ticks cada 5 m³: `Bloque1` verde (0–15), `Bloque2` amarillo (15–30) y `Bloque3` rojo (30–60).
- Relleno del color del bloque actual, marcador de la posición actual y marca punteada de la proyección al cierre.
- Solo aparece un aviso de IVA si estás a 3 m³ o menos de los 30, o si ya los pasaste. No hay resumen de base ni texto de proyección debajo de la barra.

La barra se detiene en 60 m³; si el consumo pasa de 60, el número sigue subiendo pero la barra queda al tope.

### La proyección

La proyección usa el **promedio de L/día de los últimos 7 días con datos del ciclo** y lo extiende hasta la fecha de corte. Es la única simulación de la app: no hay slider ni escenarios.

La proyección es una referencia, no una promesa. Si cambia el ritmo de consumo, cambia la proyección.

## La tabla de mediciones

La tabla muestra los datos crudos, de la medición más reciente a la más vieja:

| Columna | Qué significa |
|---|---|
| Fecha | Cuándo se midió, con hora AM/PM |
| Medición m³ | Número del medidor |
| Δ m³ | Diferencia con la medición anterior |
| Δ L | Esa diferencia en litros |
| Horas | Tiempo entre las dos mediciones, redondeado a horas enteras |
| L/h | Litros por hora entre las dos mediciones, sin la unidad en la celda |
| Nota | Nota libre, en una sola línea |

En pantallas angostas se ocultan **Δ m³**, **Horas** y **Nota**; quedan fecha, medición, Δ L y L/h. Para ver todas las columnas, usá una pantalla más ancha. Cada medición ocupa una sola fila.

- **Buscar:** el campo de búsqueda filtra por nota o por medición.
- **Favorito:** deslizá hacia la izquierda sobre una fila, o presioná `F` con la fila enfocada. La fila se pinta de verde. El favorito solo marca la fila; no filtra, no genera reportes y no se guarda en la hoja.
- **Solo lectura:** la tabla no abre ningún editor. Para corregir una fila, editá la hoja y sincronizá.
- **Outlier:** si una fila tiene un icono de advertencia al inicio, ese día tuvo un consumo atípico.

### Cómo se marcan los outliers

La app calcula un consumo diario normalizado por las horas reales entre mediciones. Los huecos no generan picos falsos.

Para cada ciclo toma los **últimos 14 días con datos** y calcula la mediana y la banda normal. Un día es outlier si supera `max(mediana × 2, mediana + 3 × MAD)`. Con menos de 5 días usa el promedio del ciclo como referencia.

La tabla solo muestra el icono de advertencia; no crea tarjetas de fuga ni analiza el texto de las notas. Los outliers de días más viejos que la ventana de 14 días no se marcan.

## Gráficas

Hay dos gráficas, una debajo de la otra: primero **Consumo** y después **Facturación**, a todo el ancho. No hay pills ni filtro de periodo: siempre comparan el ciclo actual contra el anterior.

1. **Consumo:** barras verticales agrupadas por **día del ciclo**. El **día 1 es el 20 de cada mes** y se muestran 32 días (`día 1` a `día 32`); el día 32 queda vacío porque es el corte del ciclo siguiente. La barra gris es el periodo anterior y la azul el actual. Solo se grafican mediciones reales, sin proyección; los días sin medición quedan en blanco. Chip con el total acumulado (`3.754 m³ actual`).
2. **Facturación:** mide **tarifa estimada**, no consumo. Eje Y en ₡ acumulados por día del ciclo. La factura usa base, `floor`, bloques ARESEP, cargo fijo e IVA. El chip muestra `₡5,819 actual`.

Consumo y Facturación tienen la misma altura de gráfico; el resto de la pantalla no cambia.

En **Facturación**, un **punto** marca el día en que cada periodo alcanza un bloque tarifario nuevo: 15, 30 y 60 m³ facturables. El punto usa el color del periodo y el tooltip dice `Bloque N · 15 m³`. Si el ciclo no llega al bloque, no hay punto. La leyenda lo llama **cambio de bloque**.

Consumo alinea día con día y deja en blanco lo que no tiene medición. Facturación alinea los periodos acumulados hasta el máximo; es una comparación estimada. La tabla queda debajo, a todo el ancho.

La tabla sigue mostrando L/h entre mediciones, pero los gráficos ya no usan L/h ni flujo basal.

## Configuración

El engranaje abre un diálogo con:

- **Ciclo:** día de corte 20 fijo, ciclo actual (solo `YYYY-MM`), base del ciclo y lectura anterior. Es solo lectura; la ventana avanza sola.
- **Tarifas ARESEP:** tabla combinada de solo lectura, cargo fijo e IVA.
- **Datos:** fuente Google Sheets, estado del último sync, aviso de filas locales fuera de la hoja y **Descargar CSV**. La copia de la hoja vive en el dispositivo y se usa sin red. Para bajar cambios, usá la flecha circular de la cabecera.
- **Tema:** automático, claro u oscuro.
- **Acerca de:** versión, datos locales y aviso de que la app no escribe la hoja ni usa cuenta o token.

No hay configuración de proyección, alertas, tarifas editables, importación, backup ni reset.

## Cómo se calcula la factura

Tarifas ARESEP vigentes al 2026-10-23, AyA residencial con alcantarillado, en colones por m³:

| Bloque | ₡ por m³ |
|---|---:|
| 1–15 | 873 |
| 16–30 | 1,772 |
| 31–60 | 2,239 |
| 61+ | 3,849 |

Cargo fijo: ₡3,200.

El cálculo es:

1. Truncar cada medición a m³ enteros: `floor(actual) - floor(base)`.
2. Repartir el consumo facturable en bloques.
3. Sumar los cargos fijos.
4. Si el consumo facturable supera 30 m³, aplicar IVA del 13% sobre **todo el acueducto**, no solo sobre el bloque 31.
5. Mostrar el total redondeado hacia arriba al colón.

Con 30 m³ no hay IVA. Con 31 m³ el salto es de unos **₡5,215**. Por eso la tarjeta avisa cuando la proyección cruza los 30 m³.

La factura es una estimación para presupuestar. No reemplaza el recibo de AYA.

## CSV y hoja de cálculo

La fuente única es el **CSV publicado de Google Sheets**. La hoja solo tiene tres columnas:

```csv
fecha,medicion,nota
```

- Consumo, litros, L/h, facturas y proyecciones **no** se guardan: se recalculan.
- La app lee la hoja al abrir, al volver a la pestaña, al recuperar red y al tocar la flecha circular de la cabecera.
- El merge es por `fecha|medicion`: la hoja manda en valor y nota; los favoritos locales se conservan.
- Las filas locales que no estén en la hoja se mantienen y se avisan; no se borran.
- **La app no trae datos de fábrica.** La primera vez necesita red para bajar la hoja; después guarda la copia en el dispositivo y funciona sin red.
- Las lecturas de la hoja al 24-OCT llegan hasta 23-OCT 21:23 `103.643` (extra) y 24-OCT 09:17 `103.910` (diaria); son los ejemplos de este manual.
- La hoja arranca el 20-SEP de 2026 a las 08:40 con `73.000`, sigue con `74.780`, `76.350` y `77.950` (marcadas como `medicion simulada`) y el 24-SEP real es `79.656`. Por eso el ciclo 2026-09 tiene lectura desde el día 1.
- La hoja puede venir en `MM/DD/YYYY hh:mm AM/PM` o en ISO 8601. **Descargar CSV** genera `medidor.csv` en ISO con offset `-06:00` desde la copia en memoria. Sin mediciones, el botón está desactivado.
- La app **no escribe** la hoja ni importa CSV o JSON desde la interfaz. La descarga sirve para el repo o para pegar los datos en un chat.

## Sin conexión e instalación

- La primera vez necesitás red: la app baja la hoja y guarda la copia en IndexedDB. Desde ahí abre y funciona sin red con la última copia.
- Si nunca sincronizaste y estás sin red, ves la tarjeta **Todavía no hay mediciones** con el aviso de que hace falta conectarte una vez.
- Si estás sin conexión, la cabecera muestra la etiqueta **offline** y el sync queda pendiente hasta que vuelva la red.
- No hay banner de instalación. Para instalarla, usá el menú del navegador; en iPhone o iPad, Compartir → Agregar a pantalla de inicio.
- Cuando hay una versión nueva, aparece **Actualizar / Después**. La app no recarga sola.

## Privacidad

- La app lee una hoja publicada de Google Sheets. No hay cuenta, gist ni token.
- **La hoja es pública:** quien tenga el link puede leer las notas, incluidos nombres o direcciones.
- La copia local vive en IndexedDB. No hay analytics ni CDN.
- Los favoritos son locales y no se envían a la hoja.
- Si compartís el CSV descargado, compartís esas notas.

## Glosario

- **Medición:** número del medidor en un momento, en m³.
- **Consumo:** diferencia entre mediciones, o entre la medición actual y la base.
- **Ciclo:** periodo de facturación, del 20 al 20.
- **Base:** medición de referencia del ciclo; se deriva de la última medición antes del día 20.
- **Exacto:** consumo con los tres decimales del medidor.
- **Facturable:** consumo después de truncar cada medición a m³ enteros.
- **Bloque:** tramo de consumo con tarifa propia.
- **IVA:** 13% sobre todo el acueducto cuando el consumo facturable pasa de 30 m³.
- **L/h:** litros por hora entre dos mediciones, en la tabla.
- **Promedio del ciclo:** consumo exacto del ciclo dividido entre los días transcurridos desde el corte, en m³/día.
- **Outlier:** día con consumo atípico frente a la mediana reciente.
- **Favorito:** marca personal en una fila; se pinta de verde y solo vive en ese dispositivo.
- **Hoja:** CSV publicado de Google Sheets con `fecha,medicion,nota`; es la fuente de las mediciones y la app no la escribe.
- **PWA:** app web instalable que funciona sin conexión.

## Limitaciones

- La factura es una estimación; el recibo real manda.
- No se confirma una fuga: solo se muestran outliers y el L/h crudo de la tabla.
- No hay alta ni edición dentro de la app: se hace en Google Sheets y se sincroniza.
- No hay gist, cuenta, backup ni importación.
- No se borran mediciones desde la app; se corrigen en la hoja.
- La hoja es pública: no escribas ahí datos que no quieras compartir.
- No hay notificaciones push, multiusuario ni app nativa.
- La app no reemplaza la revisión física del medidor ni de las llaves.
