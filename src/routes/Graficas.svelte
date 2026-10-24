<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from '$lib/state/store.svelte'
  import { deriveAnalytics } from '$lib/state/derive'
  import { theme } from '$lib/theme.svelte'
  import { formatDayMonth, formatTime, startOfDay } from '$lib/domain/dates'
  import { formatLph, formatM3, formatMoney } from '$lib/domain/format'
  import Icon from '$lib/components/Icon.svelte'

  type ChartInstance = { destroy: () => void }
  type ChartConstructor = new (canvas: HTMLCanvasElement, config: unknown) => ChartInstance

  const analytics = $derived(deriveAnalytics(app.state))

  let range = $state<'7d' | '30d' | 'cycle' | 'all'>('7d')
  let dailyCanvas: HTMLCanvasElement | undefined = $state()
  let accumulatedCanvas: HTMLCanvasElement | undefined = $state()
  let flowCanvas: HTMLCanvasElement | undefined = $state()
  let ChartCtor: ChartConstructor | null = null
  let loaded = $state(false)
  let charts: ChartInstance[] = []

  onMount(async () => {
    const mod = await import('chart.js/auto')
    ChartCtor = mod.default as unknown as ChartConstructor
    loaded = true
  })

  const rangeDays = $derived.by(() => {
    if (range === '7d') return analytics.days.slice(-7)
    if (range === '30d') return analytics.days.slice(-30)
    if (range === 'cycle') return analytics.cycleDays
    return analytics.days
  })

  const rangeIntervals = $derived.by(() => {
    if (range === 'all') return analytics.intervals
    const from =
      range === '7d'
        ? Date.now() - 7 * 86_400_000
        : range === '30d'
          ? Date.now() - 30 * 86_400_000
          : Date.parse(analytics.cycle.startAt)
    return analytics.intervals.filter((interval) => Date.parse(interval.to.at) >= from)
  })

  function cssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
  }

  function destroyCharts() {
    for (const chart of charts) chart.destroy()
    charts = []
  }

  function renderCharts() {
    if (!ChartCtor || !dailyCanvas || !accumulatedCanvas || !flowCanvas) return
    destroyCharts()

    const accent = cssVar('--accent', '#0a63c9')
    const text = cssVar('--text', '#0d1b2a')
    const muted = cssVar('--muted', '#5d7086')
    const border = cssVar('--border', '#d8e2ee')
    const danger = cssVar('--danger', '#b42323')
    const warn = cssVar('--warn', '#946000')
    const ok = cssVar('--ok', '#0b7a4b')

    const common = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: text,
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          ticks: {
            color: muted,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            font: { size: 10 },
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: muted, font: { size: 10 } },
          grid: { color: border },
        },
      },
    }

    const outlierAts = new Set(analytics.anomalies.map((anomaly) => anomaly.at))
    const barColors = rangeDays.map((day) =>
      outlierAts.has(day.at) ? danger : day.litersPerDay > analytics.baseline.p75 ? warn : ok,
    )

    charts.push(
      new ChartCtor(dailyCanvas, {
        type: 'bar',
        data: {
          labels: rangeDays.map((day) => formatDayMonth(startOfDay(day.day))),
          datasets: [
            {
              label: 'L/día',
              data: rangeDays.map((day) => Math.round(day.litersPerDay)),
              backgroundColor: barColors,
              borderRadius: 5,
              maxBarThickness: 28,
            },
            {
              type: 'line',
              label: 'Mediana',
              data: rangeDays.map(() => Math.round(analytics.baseline.median)),
              borderColor: accent,
              borderWidth: 1.5,
              pointRadius: 0,
              borderDash: [4, 4],
            },
            {
              type: 'line',
              label: 'Banda normal',
              data: rangeDays.map(() => Math.round(analytics.baseline.p75)),
              borderColor: muted,
              borderWidth: 1,
              pointRadius: 0,
              borderDash: [2, 4],
            },
          ],
        },
        options: common,
      }),
    )

    const cycleReadings = analytics.readings.filter(
      (reading) => Date.parse(reading.at) >= Date.parse(analytics.cycle.startAt),
    )
    const accumulated = cycleReadings.map((reading) => reading.value - analytics.cycle.baseValue)
    const labels = cycleReadings.map(
      (reading) => `${formatDayMonth(reading.at)} ${formatTime(reading.at)}`,
    )
    const projected = analytics.projection?.scenarios[0].projectedM3 ?? null
    const cumulativeProjection = Array.from(
      { length: cycleReadings.length },
      () => null as number | null,
    )
    if (labels.length > 0 && projected != null) {
      labels.push('cierre')
      cumulativeProjection[cumulativeProjection.length - 1] =
        accumulated[accumulated.length - 1] ?? 0
      cumulativeProjection.push(projected)
      accumulated.push(projected)
    }

    charts.push(
      new ChartCtor(accumulatedCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'm³ acumulados',
              data: accumulated,
              borderColor: accent,
              backgroundColor: `${accent}22`,
              fill: true,
              tension: 0.25,
              pointRadius: 2,
            },
            {
              label: 'Proyección',
              data: cumulativeProjection,
              borderColor: muted,
              borderDash: [5, 5],
              pointRadius: 0,
              spanGaps: true,
            },
            ...[15, 30, 60].map((threshold) => ({
              label: `${threshold} m³`,
              data: labels.map(() => threshold),
              borderColor: threshold === 30 ? warn : border,
              borderWidth: threshold === 30 ? 1.5 : 1,
              borderDash: [3, 5],
              pointRadius: 0,
            })),
          ],
        },
        options: {
          ...common,
          scales: {
            ...common.scales,
            y: { ...common.scales.y, suggestedMax: Math.max(30, (projected ?? 0) + 5) },
          },
        },
      }),
    )

    charts.push(
      new ChartCtor(flowCanvas, {
        type: 'line',
        data: {
          labels: rangeIntervals.map(
            (interval) => `${formatDayMonth(interval.to.at)} ${formatTime(interval.to.at)}`,
          ),
          datasets: [
            {
              label: 'L/h',
              data: rangeIntervals.map((interval) =>
                Number.isFinite(interval.lph) ? Math.max(0, Number(interval.lph.toFixed(1))) : null,
              ),
              borderColor: accent,
              backgroundColor: `${accent}22`,
              fill: true,
              tension: 0.2,
              pointRadius: 2,
            },
            {
              label: 'Flujo basal',
              data: rangeIntervals.map(() => Number(analytics.flow.basalLph.toFixed(1))),
              borderColor: analytics.flow.severity === 'ok' ? ok : danger,
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0,
            },
          ],
        },
        options: common,
      }),
    )
  }

  $effect(() => {
    // dependencias explícitas para reconstruir al cambiar rango, tema o datos
    void range
    void theme.resolved
    void app.state.updatedAt
    if (!loaded) return
    renderCharts()
    return destroyCharts
  })
</script>

<div class="between">
  <div>
    <h2>Gráficas</h2>
    <p class="small muted">
      {formatMoney(analytics.currentBill.displayTotal)} a hoy · {formatM3(
        analytics.projection?.currentExactM3 ?? 0,
      )} m³
    </p>
  </div>
  <div class="row" role="group" aria-label="Rango de la gráfica">
    {#each [['7d', '7d'], ['30d', '30d'], ['cycle', 'Ciclo'], ['all', 'Todo']] as [value, label] (value)}
      <button
        class="btn btn-sm"
        class:btn-primary={range === value}
        aria-pressed={range === value}
        onclick={() => (range = value as typeof range)}
      >
        {label}
      </button>
    {/each}
  </div>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Consumo diario</div>
      <div class="card-subtitle">Barras: L/día normalizados. Línea: mediana y banda normal.</div>
    </div>
    <span class="badge badge-neutral">{analytics.baseline.sampleSize} días</span>
  </div>
  {#if rangeDays.length === 0}
    <p class="small muted">Sin datos en este rango.</p>
  {:else}
    <div class="chart-box"><canvas bind:this={dailyCanvas}></canvas></div>
  {/if}
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Acumulado del ciclo</div>
      <div class="card-subtitle">
        Líneas punteadas: umbrales 15 / 30 / 60 m³. Proyección al cierre.
      </div>
    </div>
    <span class="badge badge-{analytics.currentBill.crossesIvaThreshold ? 'warn' : 'neutral'}">
      {analytics.currentBill.billableM3} m³
    </span>
  </div>
  <div class="chart-box"><canvas bind:this={accumulatedCanvas}></canvas></div>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Flujo entre lecturas</div>
      <div class="card-subtitle">L/h; la línea punteada es el flujo basal.</div>
    </div>
    <span
      class="badge badge-{analytics.flow.severity === 'ok'
        ? 'ok'
        : analytics.flow.severity === 'warn'
          ? 'warn'
          : 'danger'}"
    >
      <Icon name="droplet" size={13} />
      {formatLph(analytics.flow.basalLph)}
    </span>
  </div>
  {#if rangeIntervals.length === 0}
    <p class="small muted">Sin intervalos en este rango.</p>
  {:else}
    <div class="chart-box"><canvas bind:this={flowCanvas}></canvas></div>
  {/if}
</div>

<p class="tiny muted">
  Las gráficas son derivadas: si corregís una lectura, todo se recalcula. Nada de esto se guarda en
  el CSV.
</p>

<style>
  .chart-box {
    position: relative;
    height: 230px;
    margin-top: 8px;
  }

  @media (max-width: 420px) {
    .chart-box {
      height: 200px;
    }
  }
</style>
