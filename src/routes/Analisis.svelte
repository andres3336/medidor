<script lang="ts">
  import { app } from '$lib/state/store.svelte'
  import { deriveAnalytics, whatIf } from '$lib/state/derive'
  import { formatDate, formatDateTime, startOfDay } from '$lib/domain/dates'
  import {
    formatLiters,
    formatLph,
    formatM3,
    formatMoney,
    formatMultiplier,
    formatNumber,
    formatPercent,
  } from '$lib/domain/format'
  import { leakSignalText } from '$lib/domain/notes'
  import { go } from '$lib/router.svelte'
  import ConclusionCard from '$lib/components/ConclusionCard.svelte'
  import Icon from '$lib/components/Icon.svelte'

  const analytics = $derived(deriveAnalytics(app.state))
  const days = $derived(analytics.days)
  const lastDay = $derived(days.at(-1) ?? null)
  const previousDay = $derived(days.at(-2) ?? null)
  const lastWeek = $derived(days.slice(-7))
  const previousWeek = $derived(days.slice(-14, -7))

  const dayChange = $derived.by(() => {
    if (!lastDay || !previousDay || previousDay.litersPerDay === 0) return null
    return {
      liters: lastDay.litersPerDay - previousDay.litersPerDay,
      percent: ((lastDay.litersPerDay - previousDay.litersPerDay) / previousDay.litersPerDay) * 100,
      ratio: lastDay.litersPerDay / previousDay.litersPerDay,
    }
  })

  const weekChange = $derived.by(() => {
    if (lastWeek.length === 0 || previousWeek.length === 0) return null
    const current = lastWeek.reduce((total, day) => total + day.litersPerDay, 0) / lastWeek.length
    const previous =
      previousWeek.reduce((total, day) => total + day.litersPerDay, 0) / previousWeek.length
    if (previous === 0) return null
    return {
      current,
      previous,
      percent: ((current - previous) / previous) * 100,
    }
  })

  let deltaPct = $state(0)
  const deltaLiters = $derived((deltaPct / 100) * analytics.baseline.median)
  const scenario = $derived(whatIf(analytics, app.state, deltaLiters))
</script>

<div>
  <h2>Análisis</h2>
  <p class="small muted">Conclusiones, outliers, fugas y escenarios. Todo aproximado.</p>
</div>

{#each analytics.conclusions as conclusion (conclusion.id)}
  <ConclusionCard
    tone={conclusion.tone}
    icon={conclusion.tone === 'ok' ? 'check' : 'alert'}
    title={conclusion.title}
    detail={conclusion.detail}
    action={conclusion.action}
    onaction={() => (conclusion.id === 'close-due' ? go('ajustes') : go('lecturas'))}
  />
{/each}

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Outliers del periodo</div>
      <div class="card-subtitle">
        Días por encima de la banda normal, normalizados por intervalo.
      </div>
    </div>
    <span class="badge badge-neutral">{analytics.anomalies.length}</span>
  </div>
  {#if analytics.anomalies.length === 0}
    <p class="small muted">Sin outliers diarios. El consumo se mantiene dentro de la banda.</p>
  {:else}
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Día</th>
            <th class="num">L/día</th>
            <th class="num">× normal</th>
            <th class="num">Costo aprox.</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {#each [...analytics.anomalies].reverse() as anomaly (anomaly.id)}
            <tr>
              <td>{formatDate(anomaly.at)}</td>
              <td class="num">{formatNumber(anomaly.litersPerDay, 0)}</td>
              <td class="num">{formatMultiplier(anomaly.multiplier)}</td>
              <td class="num">{formatMoney(anomaly.approximateCost)}</td>
              <td class="small">{anomaly.action}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Comparaciones</div>
      <div class="card-subtitle">Día contra día y semana contra semana.</div>
    </div>
  </div>
  <div class="grid-2">
    <div class="metric">
      <div class="metric-label">Último día</div>
      <div class="metric-value">{lastDay ? formatLiters(lastDay.litersPerDay) : '—'}</div>
      {#if dayChange}
        <div class="tiny muted">
          {formatPercent(dayChange.percent)} · {formatMultiplier(dayChange.ratio)} el día anterior
        </div>
      {/if}
    </div>
    <div class="metric">
      <div class="metric-label">Últimos 7 días</div>
      <div class="metric-value">
        {#if weekChange}{formatLiters(weekChange.current)}{:else}—{/if}
      </div>
      {#if weekChange}
        <div class="tiny muted">
          {formatPercent(weekChange.percent)} vs semana anterior ({formatLiters(
            weekChange.previous,
          )})
        </div>
      {/if}
    </div>
  </div>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Flujo y fugas</div>
      <div class="card-subtitle">
        Flujo basal {formatLph(analytics.flow.basalLph)} · mínimo {formatLph(
          analytics.flow.minPositiveLph,
        )} · nocturno {analytics.flow.nocturnalLph == null
          ? '—'
          : formatLph(analytics.flow.nocturnalLph)}
      </div>
    </div>
    <span
      class="badge badge-{analytics.flow.severity === 'ok'
        ? 'ok'
        : analytics.flow.severity === 'warn'
          ? 'warn'
          : 'danger'}"
    >
      {formatM3(analytics.flow.monthlyLossM3, 2)} m³/mes
    </span>
  </div>
  <p class="small">
    Si el flujo basal sigue igual, la pérdida estimada cuesta
    <strong>{formatMoney(analytics.flow.monthlyCost)}/mes</strong>.
    {#if analytics.flow.severity === 'danger'}
      El valor está por encima del umbral de alerta. Revisá llave-medidor, llave-ducha y casa2.
    {:else if analytics.flow.severity === 'warn'}
      Hay flujo continuo sospechoso. Compará con el mínimo y con las noches.
    {:else}
      No hay señal fuerte de flujo continuo.
    {/if}
  </p>

  {#if analytics.leaks.length > 0}
    <div class="list" style="margin-top:12px">
      {#each analytics.leaks as signal (signal.at)}
        <div class="list-item">
          <span class="badge badge-{signal.severity === 'danger' ? 'danger' : 'warn'}">
            <Icon name="droplet" size={13} />
          </span>
          <div class="list-main">
            <div class="list-title small">{leakSignalText(signal)}</div>
            <div class="list-sub">
              {formatDateTime(signal.at)} · nota explica {formatNumber(signal.explainedLiters, 0)} L ·
              medidor {formatNumber(signal.measuredLiters, 0)} L
            </div>
            <div class="tiny muted">{signal.note}</div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">What-if</div>
      <div class="card-subtitle">¿Qué pasa si cambio el consumo diario hasta el cierre?</div>
    </div>
  </div>
  <label class="field">
    <span class="label">
      Cambio de {formatPercent(deltaPct)} sobre la mediana ({formatNumber(deltaLiters, 0)} L/día)
    </span>
    <input
      type="range"
      min="-50"
      max="100"
      step="10"
      bind:value={deltaPct}
      aria-label="Cambio porcentual del consumo diario"
    />
  </label>
  <div class="grid-2" style="margin-top:10px">
    <div class="metric">
      <div class="metric-label">Factura proyectada</div>
      <div class="metric-value">{formatMoney(scenario.bill.displayTotal)}</div>
      <div class="tiny muted">{scenario.m3} m³ facturables</div>
    </div>
    <div class="metric">
      <div class="metric-label">Diferencia vs hoy</div>
      <div class="metric-value">
        {formatMoney(scenario.bill.displayTotal - analytics.currentBill.displayTotal)}
      </div>
      <div class="tiny muted">aproximado, sin cargo fijo</div>
    </div>
  </div>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Historial de ciclos</div>
      <div class="card-subtitle">Factura real vs estimada, cuando la registrás.</div>
    </div>
  </div>
  <div class="table-wrap">
    <table class="data">
      <thead>
        <tr>
          <th>Ciclo</th>
          <th class="num">m³</th>
          <th class="num">Estimado</th>
          <th class="num">Real</th>
          <th class="num">Dif.</th>
        </tr>
      </thead>
      <tbody>
        {#each analytics.history as row (row.cycle.id)}
          <tr>
            <td>{row.cycle.label}</td>
            <td class="num">{row.billableM3}</td>
            <td class="num">{row.bill ? formatMoney(row.bill.displayTotal) : '—'}</td>
            <td class="num"
              >{row.cycle.actualBill ? formatMoney(row.cycle.actualBill.total) : '—'}</td
            >
            <td class="num" class:text-warn={row.difference != null && row.difference > 0}>
              {row.difference == null ? '—' : formatMoney(row.difference)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="tiny muted" style="margin-top:8px">
    La factura es una estimación. AYA puede redondear, ajustar o cortar en otra fecha.
  </p>
</div>

<p class="tiny muted">
  Base normal: mediana de {analytics.baseline.windowDays} días · {analytics.baseline.sampleSize} muestra
  {#if !analytics.baseline.sufficient}(insuficiente, uso promedio del ciclo){/if}. Último día:
  {lastDay ? formatDate(startOfDay(lastDay.day)) : '—'}.
</p>
