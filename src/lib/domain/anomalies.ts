import type { Anomaly, Baseline, DayPoint, Settings, Tariffs } from './types'
import { dailyApproximateCost } from './billing'
import { formatLiters, formatMultiplier, roundTo } from './format'
import { median, medianAbsoluteDeviation, quantile, summarize } from './stats'
import { suggestedAction } from './notes'

export type BaselineOptions = {
  windowDays: number
  multiplier: number
  madFactor: number
}

/**
 * Base normal: mediana de los últimos N días, con banda p25–p75.
 * Con menos de 5 días se marca insuficiente y se usa el promedio del ciclo
 * como referencia provisional.
 */
export function computeBaseline(
  days: DayPoint[],
  options: BaselineOptions,
  cycleAverage: number | null = null,
): Baseline {
  const window = days.slice(-options.windowDays)
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
      windowDays: options.windowDays,
    }
  }

  const center = median(values)
  const mad = medianAbsoluteDeviation(values, center)
  const limit = Math.max(center * options.multiplier, center + options.madFactor * mad)
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
      windowDays: options.windowDays,
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
    windowDays: options.windowDays,
  }
}

export function outlierLimit(baseline: Baseline, options: BaselineOptions): number {
  return Math.max(
    baseline.median * options.multiplier,
    baseline.median + options.madFactor * baseline.mad,
  )
}

export function isDailyOutlier(
  litersPerDay: number,
  baseline: Baseline,
  options: BaselineOptions,
): boolean {
  if (baseline.median <= 0) return litersPerDay > 0
  return litersPerDay > outlierLimit(baseline, options)
}

/** Costo aproximado del día, sin cargo fijo. */
export function dayCost(deltaM3: number, billableM3: number, tariffs: Tariffs): number {
  return dailyApproximateCost(deltaM3, billableM3, tariffs)
}

export type AnomalyContext = {
  billableM3: number
  tariffs: Tariffs
  settings: Settings
}

export function detectAnomalies(
  days: DayPoint[],
  baseline: Baseline,
  context: AnomalyContext,
): Anomaly[] {
  const options: BaselineOptions = {
    windowDays: context.settings.baselineWindowDays,
    multiplier: context.settings.outlier.multiplier,
    madFactor: context.settings.outlier.madFactor,
  }

  return days
    .map((day, index) => {
      if (!isDailyOutlier(day.litersPerDay, baseline, options)) return null
      const multiplier =
        baseline.median > 0 ? day.litersPerDay / baseline.median : Number.POSITIVE_INFINITY
      const cost = dayCost(day.liters / 1000, context.billableM3, context.tariffs)
      const previous = index > 0 ? days[index - 1] : null
      const previousCost = previous
        ? dayCost(previous.liters / 1000, context.billableM3, context.tariffs)
        : null
      const severity: Anomaly['severity'] =
        multiplier >= 4 || day.litersPerDay >= baseline.median + 5 * baseline.mad
          ? 'danger'
          : 'warn'

      return {
        id: `anomaly-${day.day}`,
        at: day.at,
        litersPerDay: roundTo(day.litersPerDay, 1),
        multiplier: roundTo(multiplier, 1),
        normalDaysEquivalent: roundTo(multiplier, 1),
        approximateCost: cost,
        previousCost,
        note: day.note,
        severity,
        action: suggestedAction(day.note),
      }
    })
    .filter((anomaly): anomaly is Anomaly => anomaly !== null)
}

export function anomalySentence(anomaly: Anomaly, baseline: Baseline): string {
  const base = `Se consumieron ${formatLiters(anomaly.litersPerDay)}/día, ${formatMultiplier(
    anomaly.multiplier,
  )} tu mediana de ${formatLiters(baseline.median)}/día.`
  const equivalence = `Equivale a ${formatMultiplier(anomaly.normalDaysEquivalent)} días normales en uno.`
  return `${base} ${equivalence}`
}

/** Multiplicador del día contra la mediana (para el hero de Hoy). */
export function multiplierFor(litersPerDay: number, baseline: Baseline): number {
  if (baseline.median <= 0) return 0
  return roundTo(litersPerDay / baseline.median, 1)
}

/** Banda normal p25–p75, para gráficas y radar. */
export function normalBand(baseline: Baseline): { low: number; high: number } {
  return { low: baseline.p25, high: baseline.p75 }
}

export function medianOf(values: number[]): number {
  return median(values)
}

export function p75Of(values: number[]): number {
  return quantile(values, 0.75)
}
