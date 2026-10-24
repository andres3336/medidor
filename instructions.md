# Instrucciones

## Qué es y qué no es

Medidor AYA es una app personal para **detectar anomalías de consumo de agua y actuar rápido**. No es la factura oficial: la fuente de verdad es AYA. La factura que muestra la app es una **estimación** para presupuestar, con redondeo hacia arriba.

Lo importante cada día es responder:

- ¿El consumo de ayer fue normal?
- ¿Cuánto se desvía de la mediana?
- ¿A cuántos días normales equivale?
- ¿Hay flujo continuo (posible fuga)?
- ¿Qué llave o casa puede explicarlo?
- ¿Qué hago ahora?

## Cómo agregar una lectura

1. Tocá **Agregar lectura** en Hoy o en Lecturas.
2. Escribí la medición en m³ tal como está en el medidor. Acepta `103.077` o `103,077`.
3. Ajustá la fecha y hora si la lectura es de otro momento.
4. Agregá una nota si pasó algo: “se lavó en casa2”, “llave-ducha abierta”, “no hubo agua”.
5. Marcá etiquetas y, si hay que revisar, la estrella de **flag**.

Las lecturas se guardan en el teléfono (IndexedDB). La app funciona sin conexión.

## Ciclo, corte y base

El ciclo va del día 20 al 20 de cada mes, configurable en Ajustes.

- **Base:** lectura del corte anterior. El consumo se mide desde ahí.
- **Lectura final:** la del cierre. Pasa a ser la base del ciclo nuevo.
- **Corte:** día y hora en que AYA (o vos) cierra el ciclo.

El cierre es **manual**: la app no inventa una base ni cierra sola. Desde el día de corte aparece un aviso persistente. Al cerrar podés ajustar la lectura final, el consumo facturado, la fecha/hora de corte y el monto real. Cada cambio queda auditado.

## Cómo se calcula la factura

Tarifas ARESEP vigentes al 2026-10-23, AyA residencial con alcantarillado, en colones por m³:

- Bloque 1–15: acueducto 437, alcantarillado 408, hidrantes 23, TPRH 5.
- Bloque 16–30: 875, 867, 24, 6.
- Bloque 31–60: 1,210, 997, 26, 6.
- Bloque 61+: 2,005, 1,807, 30, 7.
- Cargo fijo: acueducto 2,000; alcantarillado 1,200.

El cálculo es:

1. Se trunca cada lectura a m³ enteros: `floor(actual) - floor(base)`.
2. Se reparte el consumo en bloques.
3. Se suman los cargos fijos.
4. Si el consumo facturable supera 30 m³, se aplica IVA del 13% sobre **todo el acueducto**.
5. El total se muestra redondeado hacia arriba al colón.

## Exacto vs facturable

- **Consumo exacto:** lectura actual menos base, con 3 decimales. Sirve para entender.
- **Consumo facturable:** diferencia de las lecturas truncadas. Es el que usa AYA para cobrar.

Ejemplo: base 100.283 y lectura 103.077.

- Exacto: 2.794 m³.
- Facturable: `floor(103.077) - floor(100.283) = 103 - 100 = 3 m³`.

## El salto de IVA a los 30 m³

Con 30 m³ no hay IVA. Con 31 m³ el IVA se aplica a todo el acueducto, no solo al m³ 31. El salto es de unos **₡5,215**. Por eso la app avisa cuando la proyección cruza ese umbral o cuando estás a pocos m³.

## Fugas: L/h, flujo basal y costo

Para cada par de lecturas:

```
L/h = (lectura_2 - lectura_1) × 1000 / horas
```

- **Flujo basal:** percentil 10 de los L/h positivos. Con pocos datos, el mínimo positivo.
- **Nocturno:** promedio de los intervalos entre 22:00 y 06:00.
- **Pérdida mensual:** flujo basal × 24 × 30 / 1000 m³.
- **Costo de fuga:** diferencia de factura si ese consumo extra sigue todo el mes.

Un flujo basal de 1 L/h o más enciende el aviso amarillo; 5 L/h o más, el rojo. La app no afirma “fuga confirmada”: dice **flujo continuo sospechoso**.

## Notas vs medidor

La app lee cantidades en las notas:

- `6 litros`, `20L+5L+10L`, `0.004` (m³).
- Calcula `no explicado = litros del medidor - litros de la nota`.
- Si sobran más de 2 L (configurable), muestra la señal con los L/h no explicados.

Si la nota dice “el medidor sigue girando”, lo marca aunque no haya cantidad. Las cantidades no corrigen el CSV: son señales.

## Gráficas y outliers

- **L/día:** barras por día, normalizadas por el intervalo real. Un hueco de 3 días no genera un pico falso.
- **Banda normal:** mediana de los últimos 14 días y percentiles 25–75, descartando outliers.
- **Outlier diario:** supera `max(mediana × 2, mediana + 3 × MAD)`, configurable.
- **Acumulado:** m³ del ciclo contra los umbrales 15, 30 y 60, con proyección al cierre.
- **L/h:** flujo entre lecturas con línea de flujo basal.

## Días sin lectura: el “super error”

Si falta la lectura de ayer, o la última tiene más de 36 horas, aparece una **alerta roja bloqueante**:

- Podés agregar la lectura ahora.
- O marcarla como revisada (“Ya revisé, continuar”).

El aviso queda en Hoy hasta resolverlo. Sin lectura diaria el radar pierde precisión.

## Flags, notas y etiquetas

- **Flag:** estrella en desktop, swipe o botón en móvil. Marca una lectura para revisar.
- **Notas:** texto libre; la app busca cantidades y frases de fuga.
- **Etiquetas:** diaria, extra, incidente, ajuste, llave-medidor, llave-alfonso, llave-ducha, casa1, casa2.

## CSV y resumen para chat

- `data.csv` es la única fuente de lecturas y solo tiene `fecha,medicion,nota`.
- Consumo, litros, L/h y costos **no** se guardan: se recalculan.
- `resumen.md` incluye configuración, anomalías, fugas, factura y lecturas para pegar en un chat.
- Podés copiar el resumen o descargar ambos archivos desde Lecturas.

## Gist, backup y privacidad

- El gist es opcional y público si lo creás. La sincronización automática llega en la siguiente fase; por ahora la app guarda el token y el ID listos, y el backup JSON/CSV funciona sin gist.
- El token de GitHub vive solo en el almacenamiento local de este dispositivo; nunca va al repositorio ni al gist.
- El backup JSON exporta todo el estado.
- Las notas pueden contener nombres. Si compartís el gist, eso también se comparte.

## Glosario

- **Medidor:** contador de agua; se lee en m³.
- **Lectura / medición:** número del medidor en un momento.
- **Consumo:** diferencia entre lectura actual y base del ciclo.
- **m³:** metro cúbico, 1,000 litros.
- **L/h:** litros por hora entre dos lecturas.
- **Ciclo:** periodo de facturación; acá va del 20 al 20.
- **Corte:** lectura de cierre e inicio de ciclo.
- **Base:** lectura de referencia del ciclo actual.
- **Bloque:** tramo de consumo con tarifa propia.
- **Cargo fijo:** cobro mensual independiente del consumo.
- **Acueducto / alcantarillado / hidrantes / TPRH:** componentes de la factura.
- **IVA:** impuesto del 13%.
- **Fuga:** flujo continuo no explicado por el consumo normal.
- **Llave-medidor / llave-alfonso / llave-ducha:** llaves del inmueble.
- **Casa 1 / Casa 2:** sectores del inmueble.
- **Flag:** marca personal para revisar una lectura.
- **Outlier:** valor atípico frente al comportamiento normal.
- **Gist:** archivo remoto de GitHub.
- **PWA:** app web instalable y offline.

## Limitaciones

- La factura es una estimación; el recibo real manda.
- No hay multiusuario ni sincronización en tiempo real.
- No se scrapean tarifas: se actualizan a mano en Ajustes.
- Sin notificaciones push en esta versión.
- La app no reemplaza la revisión física del medidor ni de las llaves.
