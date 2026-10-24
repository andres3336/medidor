import type { Anomaly, Baseline, DayPoint } from './types'
import { roundTo } from './format'
import { median, medianAbsoluteDeviation, summarize } from './stats'
import { BASELINE_WINDOW_DAYS, OUTLIER_MAD_FACTOR, OUTLIER_MULTIPLIER } from './constants'

/**
 * Base normal: mediana de los últimos 14 días, con banda p25–p75.
 * Con menos de 5 días se marca insuficiente y se usa el promedio del ciclo
 * como referencia provisional.
 */
export function computeBaseline(days: DayPoint[], cycleAverage: number | null = null): Baseline {
  const window = days.slice(-BASELINE_WINDOW_DAYS)
  const values = window.map((day) => day.litersPerDay).filter((value) => Number.isFinite(value))

  if (values.length === 0) {
    return {
      median: cycleAverage ?? 0,
      p25: cycleAverage ?? 0,
      p75: cycleAverage ?? 0,
      mad: 0,
      sampleSize: 0,
      sufficient: false,
      fallback: cycleAverage != null ? 'cycle-average' : null,
      windowDays: BASELINE_WINDOW_DAYS,
    }
  }

  const center = median(values)
  const mad = medianAbsoluteDeviation(values, center)
  const limit = Math.max(center * OUTLIER_MULTIPLIER, center + OUTLIER_MAD_FACTOR * mad)
  const clean = values.filter((value) => value <= limit)
  const stats = summarize(clean.length > 0 ? clean : values)
  const sufficient = clean.length >= 5

  if (!sufficient && cycleAverage != null) {
    return {
      median: cycleAverage,
      p25: stats.p25,
      p75: stats.p75,
      mad: stats.mad,
      sampleSize: stats.sampleSize,
      sufficient: false,
      fallback: 'cycle-average',
      windowDays: BASELINE_WINDOW_DAYS,
    }
  }

  return {
    median: stats.median,
    p25: stats.p25,
    p75: stats.p75,
    mad: stats.mad,
    sampleSize: stats.sampleSize,
    sufficient,
    fallback: null,
    windowDays: BASELINE_WINDOW_DAYS,
  }
}

export function outlierLimit(baseline: Baseline): number {
  return Math.max(
    baseline.median * OUTLIER_MULTIPLIER,
    baseline.median + OUTLIER_MAD_FACTOR * baseline.mad,
  )
}

export function isDailyOutlier(litersPerDay: number, baseline: Baseline): boolean {
  if (baseline.median <= 0) return litersPerDay > 0
  return litersPerDay > outlierLimit(baseline)
}

/** Outliers diarios: solo lo necesario para pintar el warning en la tabla. */
export function detectAnomalies(days: DayPoint[], baseline: Baseline): Anomaly[] {
  return days
    .map((day) => {
      if (!isDailyOutlier(day.litersPerDay, baseline)) return null
      const multiplier =
        baseline.median > 0 ? day.litersPerDay / baseline.median : Number.POSITIVE_INFINITY
      const severity: Anomaly['severity'] =
        multiplier >= 4 || day.litersPerDay >= baseline.median + 5 * baseline.mad
          ? 'danger'
          : 'warn'

      return {
        id: `anomaly-${day.day}`,
        day: day.day,
        at: day.at,
        litersPerDay: roundTo(day.litersPerDay, 1),
        multiplier: roundTo(multiplier, 1),
        severity,
      }
    })
    .filter((anomaly): anomaly is Anomaly => anomaly !== null)
}
