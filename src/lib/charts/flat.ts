import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

Chart.defaults.font.family =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
Chart.defaults.font.size = 11

/** Colores de datos: semáforo + grises. Sin azules ni gradientes. */
export const PALETTE = {
  gray: '#8C8C8C',
  projected: '#C9CCD2',
  bandGreen: '#00A870',
  bandYellow: '#D9A300',
  bandRed: '#D92D20',
} as const

export type ChartTheme = {
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

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function chartTheme(): ChartTheme {
  return {
    text: cssVar('--text', '#111827'),
    muted: cssVar('--muted', '#6b7280'),
    grid: cssVar('--chart-grid', '#e8eaed'),
    current: cssVar('--accent', '#636EFA'),
    previous: cssVar('--chart-prev', '#B8C0CC'),
    projected: cssVar('--chart-projection', PALETTE.projected),
    bandGreen: cssVar('--block-1', PALETTE.bandGreen),
    bandYellow: cssVar('--block-2', PALETTE.bandYellow),
    bandRed: cssVar('--block-3', PALETTE.bandRed),
  }
}

export { Chart }
