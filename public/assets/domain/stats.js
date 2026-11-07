export function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

export function mean(values) {
  return values.length === 0 ? 0 : sum(values) / values.length
}

export function median(values) {
  return quantile(values, 0.5)
}

/** Quantile with linear interpolation over sorted data. */
export function quantile(values, q) {
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

/** Median absolute deviation. */
export function medianAbsoluteDeviation(values, center = median(values)) {
  return median(values.map((value) => Math.abs(value - center)))
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function maxOrNull(values) {
  return values.length === 0 ? null : Math.max(...values)
}

export function minPositive(values) {
  const positive = values.filter((value) => value > 0)
  return positive.length === 0 ? null : Math.min(...positive)
}

export function summarize(values) {
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
