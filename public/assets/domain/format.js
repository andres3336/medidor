/** Number formatting and parsing. Decimal point, thousands comma (like the original CSV). */

export function roundTo(value, decimals) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Readings are truncated to 3 decimals (the meter's real m³). */
export function truncate3(value) {
  return Math.floor((value + Number.EPSILON) * 1000) / 1000
}

/**
 * Accepts `103.077`, `103,077` and `1,234.567`.
 * With a comma and a dot, the comma is the thousands separator. With only a
 * comma, it is the decimal separator.
 */
export function parseDecimalInput(input) {
  let value = input.trim().replace(/\s/g, '').replace(/[₡$]/g, '')
  if (!value) return null
  if (value.includes(',') && value.includes('.')) value = value.replace(/,/g, '')
  else if (value.includes(',')) value = value.replace(',', '.')
  if (!/^-?\d*(\.\d*)?$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** A reading only accepts digits and one decimal point. */
export function sanitizeMeasurementInput(raw) {
  const digitsAndDots = raw.replace(/[^0-9.]/g, '')
  const firstDot = digitsAndDots.indexOf('.')
  if (firstDot < 0) return digitsAndDots
  return digitsAndDots.slice(0, firstDot + 1) + digitsAndDots.slice(firstDot + 1).replaceAll('.', '')
}

export function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** m³ with the requested decimals (3 by default), so precision stays visible. */
export function formatM3(value, decimals = 3) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatLiters(value) {
  return `${formatNumber(Math.round(value), 0)} L`
}

export function formatLph(value) {
  return `${formatNumber(roundTo(value, 1), 1)} L/h`
}

/** The total is rounded up to the colón: we never promise cents. */
export function formatMoney(value) {
  const rounded = Math.ceil(value - 1e-9)
  const normalized = Object.is(rounded, -0) ? 0 : rounded
  if (normalized < 0) return `-₡${formatNumber(Math.abs(normalized), 0)}`
  return `₡${formatNumber(normalized, 0)}`
}

export function formatMoneyShort(value) {
  const rounded = Math.ceil(value - 1e-9)
  if (Math.abs(rounded) >= 1_000_000) return `₡${formatNumber(rounded / 1_000_000, 1)} M`
  if (Math.abs(rounded) >= 10_000) return `₡${formatNumber(rounded / 1000, 1)}k`
  return formatMoney(value)
}

export function formatMultiplier(value) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${formatNumber(roundTo(value, 1), 1)}×`
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(roundTo(value, 0), 0)}%`
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural
}

export const DECIMALS = { m3: 3, liters: 0, flow: 1, money: 0 }
