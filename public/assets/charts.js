import {
  buildBillComparison,
  buildCycleSeries,
  buildDailyComparison,
  findBlockMilestones,
} from './domain/periods.js'
import { ARESEP_TARIFFS_2026_10_23 } from './domain/tariffs.js'
import { formatDayMonth } from './domain/dates.js'
import { formatM3, formatMoney, formatNumber } from './domain/format.js'

/**
 * Everything the two charts need, derived once per render.
 * Pure: no canvas, no Chart.js.
 */
export function buildChartModel(analytics) {
  const tariffs = ARESEP_TARIFFS_2026_10_23
  const billComparison = buildBillComparison(
    analytics.cycles,
    analytics.readings,
    analytics.cycle,
    analytics.projection,
    tariffs,
  )
  const previousCycle = billComparison.previous?.cycle ?? null
  const currentSeries = buildCycleSeries(analytics.cycle, analytics.readings, analytics.projection)
  const previousSeries = previousCycle
    ? buildCycleSeries(previousCycle, analytics.readings, null)
    : null
  const currentMilestones = findBlockMilestones(analytics.cycle, analytics.readings, tariffs)
  const previousMilestones = previousCycle
    ? findBlockMilestones(previousCycle, analytics.readings, tariffs)
    : []
  const hasUsage = currentSeries.points.length > 1 || (previousSeries?.points.length ?? 0) > 1
  const hasMilestones = currentMilestones.length + previousMilestones.length > 0
  const dailyComparison = buildDailyComparison(analytics.cycle, previousCycle, analytics.days)
  const hasHigher = dailyComparison.days.some((point) => point.higherThanPrevious === true)

  return {
    cycle: analytics.cycle,
    projection: analytics.projection,
    tariffs,
    billComparison,
    previousCycle,
    currentSeries,
    previousSeries,
    currentMilestones,
    previousMilestones,
    hasUsage,
    hasMilestones,
    dailyComparison,
    hasHigher,
  }
}

/* ------------------------------------------------------------------ theme */

const DEFAULT_FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const PALETTE = {
  projected: '#C9CCD2',
  bandGreen: '#00A870',
  bandYellow: '#D9A300',
  bandRed: '#D92D20',
}

let defaultsReady = false
let chartInstances = []

function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function chartTheme() {
  return {
    text: cssVar('--text', '#111827'),
    muted: cssVar('--muted', '#6b7280'),
    grid: cssVar('--chart-grid', '#e8eaed'),
    current: cssVar('--accent', '#636EFA'),
    previous: cssVar('--chart-prev', '#B8C0CC'),
    higher: cssVar('--chart-over', '#D97706'),
    projected: cssVar('--chart-projection', PALETTE.projected),
    bandGreen: cssVar('--block-1', PALETTE.bandGreen),
    bandYellow: cssVar('--block-2', PALETTE.bandYellow),
    bandRed: cssVar('--block-3', PALETTE.bandRed),
    surface: cssVar('--surface', '#ffffff'),
  }
}

/** Converts a hex theme color into rgba for soft fills. */
function withAlpha(color, alpha) {
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

function prepareDefaults(Chart) {
  if (defaultsReady) return
  Chart.defaults.font.family = DEFAULT_FONT
  Chart.defaults.font.size = 11
  defaultsReady = true
}

function baseOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.text,
        titleColor: '#fff',
        bodyColor: '#fff',
        displayColors: false,
        cornerRadius: 0,
        padding: 8,
        titleFont: { size: 11, weight: '600' },
        bodyFont: { size: 11 },
      },
    },
    scales: {
      x: {
        ticks: {
          color: colors.muted,
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
          color: colors.muted,
          maxTicksLimit: 5,
          padding: 4,
          font: { size: 10 },
        },
        grid: { color: colors.grid, drawTicks: false },
        border: { display: false },
      },
    },
  }
}

/* ------------------------------------------------------------------ charts */

function destroyCharts() {
  for (const chart of chartInstances) chart.destroy()
  chartInstances = []
}

function renderUsageChart(Chart, canvas, model, colors) {
  const labels = model.dailyComparison.days.map((point) => `Day ${point.dayNumber}`)
  const currentDatasetIndex = model.previousCycle ? 1 : 0
  const options = baseOptions(colors)
  const datasets = []

  if (model.previousCycle) {
    datasets.push({
      type: 'bar',
      label: model.previousCycle.id,
      data: model.dailyComparison.days.map((point) => point.previousM3),
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
    label: `${model.cycle.id} current`,
    data: model.dailyComparison.days.map((point) => point.currentM3),
    backgroundColor: model.dailyComparison.days.map((point) =>
      point.higherThanPrevious ? colors.higher : colors.current,
    ),
    borderWidth: 0,
    borderRadius: 0,
    barPercentage: 0.9,
    categoryPercentage: 0.8,
    maxBarThickness: 24,
  })

  chartInstances.push(
    new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        ...options,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'category',
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
              callback: (value) => formatNumber(value, 2),
            },
            grid: { color: colors.grid, drawTicks: false },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...options.plugins.tooltip,
            filter: (item) => item.parsed.y != null,
            callbacks: {
              title: (items) => {
                const point = model.dailyComparison.days[items[0]?.dataIndex ?? 0]
                return `Day ${point?.dayNumber ?? 1}`
              },
              label: (item) => {
                if (item.parsed.y == null) return ''
                const point = model.dailyComparison.days[item.dataIndex]
                const isCurrent = item.datasetIndex === currentDatasetIndex
                const at = isCurrent ? point?.currentAt : point?.previousAt
                const date = at ? ` · ${formatDayMonth(at)}` : ''
                const over =
                  isCurrent && point?.higherThanPrevious ? ' · above the previous cycle' : ''
                return `${item.dataset.label ?? ''}${date}: ${formatM3(item.parsed.y)} m³/day${over}`
              },
            },
          },
        },
      },
    }),
  )
}

/** Point where the cycle reaches a new tariff block. */
function milestoneDataset(label, milestones, color, colors) {
  return {
    type: 'line',
    label: `${label} blocks`,
    milestone: true,
    data: milestones.map((milestone) => ({
      x: milestone.index + 1,
      y: milestone.amount,
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

function billingTooltipLabel(item) {
  if (item.dataset.milestone) {
    const threshold = item.raw?.threshold
    const name = `Block ${item.raw?.block ?? ''}`.trim()
    return threshold == null ? name : `${name} · ${formatM3(threshold)} m³`
  }
  const label = item.dataset.label ?? ''
  return `${label}: ${formatMoney(item.parsed.y)}`
}

function renderBillingChart(Chart, canvas, model, colors) {
  const previous = model.billComparison.previous
  const current = model.billComparison.current
  const datasets = []
  const dayTicks = [1, 5, 10, 15, 20, 25, 30]

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
    if (model.previousMilestones.length > 0) {
      datasets.push(
        milestoneDataset(previous.cycle.id, model.previousMilestones, colors.previous, colors),
      )
    }
  }

  datasets.push({
    type: 'line',
    label: `${current.cycle.id} current`,
    data: current.points.map((point) => ({ x: point.index + 1, y: point.amount })),
    borderColor: colors.current,
    backgroundColor: withAlpha(colors.current, 0.18),
    borderWidth: 3,
    pointRadius: 0,
    tension: 0,
    fill: 'origin',
  })

  if (model.currentMilestones.length > 0) {
    datasets.push(
      milestoneDataset(current.cycle.id, model.currentMilestones, colors.current, colors),
    )
  }

  if (current.projected.length > 1) {
    datasets.push({
      type: 'line',
      label: 'projection',
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
  chartInstances.push(
    new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        ...options,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            min: 1,
            max: model.billComparison.maxIndex + 1,
            ticks: {
              color: colors.muted,
              maxTicksLimit: 8,
              font: { size: 10 },
              callback: (value) => `Day ${Math.round(value)}`,
            },
            afterBuildTicks: (axis) => {
              axis.ticks = dayTicks
                .filter((value) => value <= model.billComparison.maxIndex + 1)
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
              callback: (value) => formatMoney(value),
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
              title: (items) => `Day ${Math.floor(items[0]?.parsed.x ?? 1)}`,
              label: (item) => billingTooltipLabel(item),
            },
          },
        },
      },
    }),
  )
}

/* ------------------------------------------------------------------ render */

export function renderCharts(model) {
  const Chart = typeof window !== 'undefined' ? window.Chart : undefined
  if (!Chart || !model) return

  prepareDefaults(Chart)
  destroyCharts()

  const colors = chartTheme()
  const usageCanvas = document.querySelector('#consumption-chart')
  const billingCanvas = document.querySelector('#billing-chart')

  if (usageCanvas) renderUsageChart(Chart, usageCanvas, model, colors)
  if (billingCanvas) renderBillingChart(Chart, billingCanvas, model, colors)
}
