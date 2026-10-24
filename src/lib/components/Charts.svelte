<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from '../state/store.svelte'
  import { theme } from '../theme.svelte'
  import type { Analytics } from '../state/derive'
  import { buildBillComparison, buildDailyCycle } from '../domain/periods'
  import { ARESEP_TARIFFS_2026_10_23 } from '../domain/tariffs'
  import { formatM3, formatMoney, formatNumber } from '../domain/format'

  type ChartInstance = { destroy: () => void }
  type ChartCtor = new (canvas: HTMLCanvasElement, config: unknown) => ChartInstance
  type ChartTheme = {
    text: string
    muted: string
    grid: string
    current: string
    previous: string
    projected: string
    bandGreen: string
    bandYellow: string
    bandRed: string
  }
  type ChartThemeFn = () => ChartTheme

  let { analytics }: { analytics: Analytics } = $props()

  let ChartCtor: ChartCtor | null = null
  let chartThemeFn: ChartThemeFn | null = null
  let loaded = $state(false)
  let charts: ChartInstance[] = []

  let curveCanvas: HTMLCanvasElement | undefined = $state()
  let billCanvas: HTMLCanvasElement | undefined = $state()

  const billComparison = $derived(
    buildBillComparison(
      analytics.cycles,
      analytics.readings,
      analytics.cycle,
      analytics.projection,
      ARESEP_TARIFFS_2026_10_23,
    ),
  )
  const previousCycle = $derived(billComparison.previous?.cycle ?? null)
  const currentDaily = $derived(
    buildDailyCycle(analytics.cycle, analytics.days, null, new Date(), analytics.hasReadingToday),
  )
  const previousDaily = $derived(
    previousCycle ? buildDailyCycle(previousCycle, analytics.days, null) : [],
  )
  const dayTicks = [1, 5, 10, 15, 20, 25, 30]

  onMount(async () => {
    const mod = await import('../charts/flat')
    ChartCtor = mod.Chart as unknown as ChartCtor
    chartThemeFn = mod.chartTheme
    loaded = true
  })

  function destroyCharts() {
    for (const chart of charts) chart.destroy()
    charts = []
  }

  /** Convierte un color hex del tema en rgba para rellenos suaves. */
  function withAlpha(color: string, alpha: number): string {
    const value = color.trim()
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
    if (!match) return value
    const raw = match[1]
    const hex =
      raw.length === 3
        ? raw
            .split('')
            .map((char) => char + char)
            .join('')
        : raw
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  function baseOptions(themeColors: ChartTheme) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: themeColors.text,
          titleColor: '#fff',
          bodyColor: '#fff',
          displayColors: false,
          cornerRadius: 0,
          padding: 8,
          titleFont: { size: 11, weight: '600' as const },
          bodyFont: { size: 11 },
        },
      },
      scales: {
        x: {
          ticks: {
            color: themeColors.muted,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            font: { size: 10 },
          },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: themeColors.muted,
            maxTicksLimit: 5,
            padding: 4,
            font: { size: 10 },
          },
          grid: { color: themeColors.grid, drawTicks: false },
          border: { display: false },
        },
      },
    }
  }

  function renderCharts() {
    if (!ChartCtor || !chartThemeFn) return
    if (!curveCanvas && !billCanvas) return
    destroyCharts()
    const colors = chartThemeFn()

    if (
      curveCanvas &&
      (currentDaily.some((point) => point.kind === 'actual') ||
        previousDaily.some((point) => point.kind === 'actual'))
    ) {
      const maxDay = Math.max(currentDaily.length, previousDaily.length)
      const datasets: unknown[] = []

      if (previousCycle) {
        const previousPoints = previousDaily.filter((point) => point.kind === 'actual')
        datasets.push({
          type: 'line',
          label: previousCycle.id,
          data: previousPoints.map((point) => ({ x: point.dayNumber, y: point.m3PerDay })),
          borderColor: colors.previous,
          backgroundColor: colors.previous,
          borderWidth: 1.5,
          pointRadius: 1.5,
          pointHoverRadius: 3.5,
          pointHitRadius: 8,
          pointBackgroundColor: colors.previous,
          pointBorderColor: colors.previous,
          tension: 0.35,
          cubicInterpolationMode: 'monotone' as const,
          fill: false,
        })
      }

      const currentPoints = currentDaily.filter((point) => point.kind === 'actual')
      datasets.push({
        type: 'line',
        label: analytics.cycle.id,
        data: currentPoints.map((point) => ({ x: point.dayNumber, y: point.m3PerDay })),
        borderColor: colors.current,
        backgroundColor: colors.current,
        borderWidth: 3,
        pointRadius: 1.5,
        pointHoverRadius: 3.5,
        pointHitRadius: 8,
        pointBackgroundColor: colors.current,
        pointBorderColor: colors.current,
        tension: 0.35,
        cubicInterpolationMode: 'monotone' as const,
        fill: false,
      })

      const options = baseOptions(colors)
      charts.push(
        new ChartCtor(curveCanvas, {
          type: 'line',
          data: { datasets },
          options: {
            ...options,
            interaction: { mode: 'nearest' as const, intersect: false },
            scales: {
              x: {
                type: 'linear',
                min: 1,
                max: maxDay,
                ticks: {
                  color: colors.muted,
                  maxTicksLimit: 8,
                  font: { size: 10 },
                  callback: (value: number) => `día ${Math.round(value)}`,
                },
                afterBuildTicks: (axis: { ticks: Array<{ value: number }> }) => {
                  axis.ticks = dayTicks
                    .filter((value) => value <= maxDay)
                    .map((value) => ({ value }))
                },
                grid: { display: false },
                border: { display: false },
              },
              y: {
                beginAtZero: true,
                ticks: {
                  color: colors.muted,
                  maxTicksLimit: 6,
                  padding: 4,
                  font: { size: 10 },
                  callback: (value: number) => formatNumber(value, 2),
                },
                grid: { color: colors.grid, drawTicks: false },
                border: { display: false },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...options.plugins.tooltip,
                callbacks: {
                  title: (items: Array<{ parsed: { x: number } }>) =>
                    `Día ${Math.floor(items[0]?.parsed.x ?? 1)}`,
                  label: (item: { dataset: { label?: string }; parsed: { y: number } }) =>
                    `${item.dataset.label ?? ''}: ${formatM3(item.parsed.y)} m³/día`,
                },
              },
            },
          },
        }),
      )
    }

    if (billCanvas && analytics.cycle.baseValue != null) {
      const previous = billComparison.previous
      const current = billComparison.current
      const datasets: unknown[] = []

      if (previous) {
        datasets.push({
          type: 'line',
          label: previous.cycle.id,
          data: previous.points.map((point) => ({ x: point.index + 1, y: point.amount })),
          borderColor: colors.previous,
          backgroundColor: colors.previous,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          fill: false,
        })
      }

      datasets.push({
        type: 'line',
        label: `${current.cycle.id} real`,
        data: current.points.map((point) => ({ x: point.index + 1, y: point.amount })),
        borderColor: colors.current,
        backgroundColor: withAlpha(colors.current, 0.18),
        borderWidth: 3,
        pointRadius: 0,
        tension: 0,
        fill: 'origin' as const,
      })

      if (current.projected.length > 1) {
        datasets.push({
          type: 'line',
          label: 'proyección',
          data: current.projected.map((point) => ({ x: point.index + 1, y: point.amount })),
          borderColor: colors.projected,
          backgroundColor: colors.projected,
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0,
          fill: false,
        })
      }

      const options = baseOptions(colors)
      charts.push(
        new ChartCtor(billCanvas, {
          type: 'line',
          data: { datasets },
          options: {
            ...options,
            interaction: { mode: 'nearest' as const, intersect: false },
            scales: {
              x: {
                type: 'linear',
                min: 1,
                max: billComparison.maxIndex + 1,
                ticks: {
                  color: colors.muted,
                  maxTicksLimit: 8,
                  font: { size: 10 },
                  callback: (value: number) => `día ${Math.round(value)}`,
                },
                afterBuildTicks: (axis: { ticks: Array<{ value: number }> }) => {
                  axis.ticks = dayTicks
                    .filter((value) => value <= billComparison.maxIndex + 1)
                    .map((value) => ({ value }))
                },
                grid: { display: false },
                border: { display: false },
              },
              y: {
                beginAtZero: true,
                ticks: {
                  color: colors.muted,
                  maxTicksLimit: 5,
                  padding: 4,
                  font: { size: 10 },
                  callback: (value: number) => formatMoney(value),
                },
                grid: { color: colors.grid, drawTicks: false },
                border: { display: false },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...options.plugins.tooltip,
                callbacks: {
                  title: (items: Array<{ parsed: { x: number } }>) =>
                    `Día ${Math.floor(items[0]?.parsed.x ?? 1)}`,
                  label: (item: { dataset: { label?: string }; parsed: { y: number } }) =>
                    `${item.dataset.label ?? ''}: ${formatMoney(item.parsed.y)}`,
                },
              },
            },
          },
        }),
      )
    }
  }

  $effect(() => {
    void theme.resolved
    void app.state.updatedAt
    void analytics
    if (!loaded) return
    renderCharts()
    return destroyCharts
  })
</script>

<section class="charts-section" aria-labelledby="charts-title">
  <div class="charts-head">
    <div>
      <h2 class="section-title" id="charts-title">Gráficas</h2>
      <p class="small muted">Curva diaria y tarifa estimada, siempre actual vs anterior.</p>
    </div>
  </div>

  <div class="card flat chart-card">
    <div class="card-header">
      <div>
        <div class="card-title">Curva de consumo</div>
        <div class="card-subtitle">m³/día actual vs anterior, por día del ciclo.</div>
      </div>
      <span class="chip">
        {analytics.averageM3PerDay == null
          ? '—'
          : `${formatM3(analytics.averageM3PerDay, 2)} m³/día actual`}
      </span>
    </div>
    {#if currentDaily.every((point) => point.kind !== 'actual') && previousDaily.every((point) => point.kind !== 'actual')}
      <p class="small muted">Sin mediciones para comparar.</p>
    {:else}
      <div class="chart-box"><canvas bind:this={curveCanvas}></canvas></div>
      <div class="chart-legend tiny">
        {#if previousCycle}
          <span><i class="legend-prev"></i>{previousCycle.id}</span>
        {/if}
        <span><i class="legend-current"></i>{analytics.cycle.id} actual</span>
      </div>
    {/if}
  </div>

  <div class="card flat chart-card">
    <div class="card-header">
      <div>
        <div class="card-title">Periodo anterior vs actual</div>
        <div class="card-subtitle">
          ₡ estimados acumulados por día del ciclo; líneas actual vs anterior y área bajo el actual.
        </div>
      </div>
      {#if analytics.cycle.baseValue == null}
        <span class="badge badge-warn">sin base</span>
      {:else}
        <span class="chip">{formatMoney(billComparison.current.totalAmount)} actual</span>
      {/if}
    </div>
    {#if analytics.cycle.baseValue == null}
      <p class="small muted">Falta la base del ciclo actual.</p>
    {:else}
      <div class="chart-box"><canvas bind:this={billCanvas}></canvas></div>
      <div class="chart-legend tiny">
        {#if billComparison.previous}
          <span><i class="legend-prev"></i>{billComparison.previous.cycle.id}</span>
        {/if}
        <span><i class="legend-current"></i>{analytics.cycle.id} actual</span>
        {#if analytics.projection && analytics.cycle.open}
          <span><i class="legend-dash"></i>proyección</span>
        {/if}
      </div>
    {/if}
  </div>
</section>
