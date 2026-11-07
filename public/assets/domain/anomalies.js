import { roundTo } from './format.js'
import { median, medianAbsoluteDeviation, summarize } from './stats.js'
import { BASELINE_WINDOW_DAYS, OUTLIER_MAD_FACTOR, OUTLIER_MULTIPLIER } from './constants.js'

/**
 * Normal baseline: median of the last 14 days, with a p25–p75 band.
 * With fewer than 5 days it is marked insufficient and the cycle average is
 * used as a provisional reference.
 */
export function computeBaseline(days, cycleAverage = null) {
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

export function outlierLimit(baseline) {
  return Math.max(
    baseline.median * OUTLIER_MULTIPLIER,
    baseline.median + OUTLIER_MAD_FACTOR * baseline.mad,
  )
}

export function isDailyOutlier(litersPerDay, baseline) {
  if (baseline.median <= 0) return litersPerDay > 0
  return litersPerDay > outlierLimit(baseline)
}

/** Daily outliers: just enough to paint the warning in the table. */
export function detectAnomalies(days, baseline) {
  return days
    .map((day) => {
      if (!isDailyOutlier(day.litersPerDay, baseline)) return null
      const multiplier =
        baseline.median > 0 ? day.litersPerDay / baseline.median : Number.POSITIVE_INFINITY
      const severity =
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
    .filter((anomaly) => anomaly !== null)
}
