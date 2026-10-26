<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from '../state/store.svelte'
  import { theme } from '../theme.svelte'
  import type { Analytics } from '../state/derive'
  import {
    buildBillComparison,
    buildCycleSeries,
    buildDailyComparison,
    findBlockMilestones,
  } from '../domain/periods'
  import type { BlockMilestone } from '../domain/periods'
  import { ARESEP_TARIFFS_2026_10_23 } from '../domain/tariffs'
  import { formatDayMonth } from '../domain/dates'
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
    surface: string
  }
  type ChartThemeFn = () => ChartTheme
  type TooltipItem = {
    dataset: { label?: string; milestone?: boolean }
    parsed: { y: number }
    raw?: { block?: number; threshold?: number }
  }
  type BarTooltipItem = {
    dataset: { label?: string }
    datasetIndex: number
    dataIndex: number
    parsed: { y: number | null }
  }

  let { analytics }: { analytics: Analytics } = $props()

  let ChartCtor: ChartCtor | null = null
  let chartThemeFn: ChartThemeFn | null = null
  let loaded = $state(false)
  let charts: ChartInstance[] = []

  let curveCanvas: HTMLCanvasElement | undefined = $state()
  let billCanvas: HTMLCanvasElement | undefined = $state()

  const tariffs = ARESEP_TARIFFS_2026_10_23
  const billComparison = $derived(
    buildBillComparison(
      analytics.cycles,
      analytics.readings,
      analytics.cycle,
      analytics.projection,
      tariffs,
    ),
  )
  const previousCycle = $derived(billComparison.previous?.cycle ?? null)
  const currentSeries = $derived(
    buildCycleSeries(analytics.cycle, analytics.readings, analytics.projection),
  )
  const previousSeries = $derived(
    previousCycle ? buildCycleSeries(previousCycle, analytics.readings, null) : null,
  )
  const currentMilestones = $derived(
    findBlockMilestones(analytics.cycle, analytics.readings, tariffs),
  )
  const previousMilestones = $derived(
    previousCycle ? findBlockMilestones(previousCycle, analytics.readings, tariffs) : [],
  )
  const hasConsumo = $derived(
    currentSeries.points.length > 1 || (previousSeries?.points.length ?? 0) > 1,
  )
  const hasMilestones = $derived(currentMilestones.length + previousMilestones.length > 0)
  const dailyComparison = $derived(
    buildDailyComparison(analytics.cycle, previousCycle, analytics.days),
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

  function tooltipLabel(item: TooltipItem, unit: 'm3' | 'money'): string {
    if (item.dataset.milestone) {
      const threshold = item.raw?.threshold
      const name = `Bloque ${item.raw?.block ?? ''}`.trim()
      return threshold == null ? name : `${name} · ${formatM3(threshold)} m³`
    }
    const label = item.dataset.label ?? ''
    return unit === 'money'
      ? `${label}: ${formatMoney(item.parsed.y)}`
      : `${label}: ${formatM3(item.parsed.y)} m³`
  }

  /** Punto donde el ciclo alcanza un bloque tarifario nuevo. */
  function milestoneDataset(
    label: string,
    milestones: BlockMilestone[],
    unit: 'm3' | 'money',
    color: string,
    colors: ChartTheme,
  ) {
    return {
      type: 'line',
      label: `${label} bloques`,
      milestone: true,
      data: milestones.map((milestone) => ({
        x: milestone.index + 1,
        y: unit === 'm3' ? milestone.m3 : milestone.amount,
        block: milestone.block,
        threshold: milestone.thresholdM3,
      })),
      borderColor: color,
      backgroundColor: color,
      pointBackgroundColor: color,
      pointBorderColor: colors.surface,
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointHitRadius: 12,
      showLine: false,
      order: 1,
    }
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

  function renderDailyConsumptionChart(canvas: HTMLCanvasElement, colors: ChartTheme) {
    if (!ChartCtor) return

    const labels = dailyComparison.days.map((point) => `día ${point.dayNumber}`)
    const currentDatasetIndex = previousCycle ? 1 : 0
    const options = baseOptions(colors)
    const datasets: unknown[] = []

    if (previousCycle) {
      datasets.push({
        type: 'bar',
        label: previousCycle.id,
        data: dailyComparison.days.map((point) => point.previousM3),
        backgroundColor: colors.previous,
        borderWidth: 0,
        borderRadius: 0,
        barPercentage: 0.9,
        categoryPercentage: 0.8,
        maxBarThickness: 24,
      })
    }

    datasets.push({
      type: 'bar',
      label: `${analytics.cycle.id} actual`,
      data: dailyComparison.days.map((point) => point.currentM3),
      backgroundColor: colors.current,
      borderWidth: 0,
      borderRadius: 0,
      barPercentage: 0.9,
      categoryPercentage: 0.8,
      maxBarThickness: 24,
    })

    charts.push(
      new ChartCtor(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          ...options,
          interaction: { mode: 'index' as const, intersect: false },
          scales: {
            x: {
              type: 'category' as const,
              offset: true,
              ticks: {
                color: colors.muted,
                autoSkip: true,
                maxTicksLimit: 8,
                maxRotation: 0,
                padding: 4,
                font: { size: 10 },
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
              filter: (item: BarTooltipItem) => item.parsed.y != null,
              callbacks: {
                title: (items: BarTooltipItem[]) => {
                  const point = dailyComparison.days[items[0]?.dataIndex ?? 0]
                  return `Día ${point?.dayNumber ?? 1}`
                },
                label: (item: BarTooltipItem) => {
                  if (item.parsed.y == null) return ''
                  const point = dailyComparison.days[item.dataIndex]
                  const isCurrent = item.datasetIndex === currentDatasetIndex
                  const at = isCurrent ? point?.currentAt : point?.previousAt
                  const date = at ? ` · ${formatDayMonth(at)}` : ''
                  return `${item.dataset.label ?? ''}${date}: ${formatM3(item.parsed.y)} m³/día`
                },
              },
            },
          },
        },
      }),
    )
  }

  function renderCharts() {
    if (!ChartCtor || !chartThemeFn) return
    if (!curveCanvas && !billCanvas) return
    destroyCharts()
    const colors = chartThemeFn()

    if (curveCanvas && analytics.cycle.baseValue != null && hasConsumo) {
      renderDailyConsumptionChart(curveCanvas, colors)
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
        if (previousMilestones.length > 0) {
          datasets.push(
            milestoneDataset(
              previous.cycle.id,
              previousMilestones,
              'money',
              colors.previous,
              colors,
            ),
          )
        }
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

      if (currentMilestones.length > 0) {
        datasets.push(
          milestoneDataset(current.cycle.id, currentMilestones, 'money', colors.current, colors),
        )
      }

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
                  label: (item: TooltipItem) => tooltipLabel(item, 'money'),
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
    </div>
  </div>

  <div class="card flat chart-card">
    <div class="card-header">
      <div>
        <div class="card-title">Consumo</div>
        <div class="card-subtitle">m³ por día del ciclo; día 1 = 20 de cada mes.</div>
      </div>
      {#if analytics.cycle.baseValue == null}
        <span class="badge badge-warn">sin base</span>
      {:else}
        <span class="chip">{formatM3(currentSeries.totalM3)} m³ actual</span>
      {/if}
    </div>
    {#if analytics.cycle.baseValue == null}
      <p class="small muted">Falta la base del ciclo actual.</p>
    {:else if !hasConsumo}
      <p class="small muted">Sin mediciones para comparar.</p>
    {:else}
      <div class="chart-box"><canvas bind:this={curveCanvas}></canvas></div>
      <div class="chart-legend tiny">
        {#if previousCycle}
          <span><i class="legend-bar legend-prev"></i>{previousCycle.id}</span>
        {/if}
        <span><i class="legend-bar legend-current"></i>{analytics.cycle.id} actual</span>
      </div>
    {/if}
  </div>

  <div class="card flat chart-card">
    <div class="card-header">
      <div>
        <div class="card-title">Facturación</div>
        <div class="card-subtitle">₡ estimados acumulados por día del ciclo.</div>
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
        {#if hasMilestones}
          <span><i class="legend-dot"></i>cambio de bloque</span>
        {/if}
      </div>
    {/if}
  </div>
</section>
