export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length
}

export function median(values: number[]): number {
  return quantile(values, 0.5)
}

/** Cuantil con interpolación lineal sobre datos ordenados. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q))
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/** Desviación absoluta mediana. */
export function medianAbsoluteDeviation(values: number[], center = median(values)): number {
  return median(values.map((value) => Math.abs(value - center)))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function maxOrNull(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values)
}

export function minPositive(values: number[]): number | null {
  const positive = values.filter((value) => value > 0)
  return positive.length === 0 ? null : Math.min(...positive)
}

export type SummaryStats = {
  median: number
  p25: number
  p75: number
  mad: number
  mean: number
  sampleSize: number
}

export function summarize(values: number[]): SummaryStats {
  const center = median(values)
  return {
    median: center,
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    mad: medianAbsoluteDeviation(values, center),
    mean: mean(values),
    sampleSize: values.length,
  }
}
