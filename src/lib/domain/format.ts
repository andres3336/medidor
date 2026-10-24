/** Formato y parseo de números. Punto decimal, coma de miles (como el CSV original). */

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Las lecturas se truncan a 3 decimales (m³ reales del medidor). */
export function truncate3(value: number): number {
  return Math.floor((value + Number.EPSILON) * 1000) / 1000
}

/**
 * Acepta `103.077`, `103,077` y `1,234.567`.
 * Si hay coma y punto, la coma es de miles. Si solo hay coma, es decimal.
 */
export function parseDecimalInput(input: string): number | null {
  let value = input.trim().replace(/\s/g, '').replace(/[₡$]/g, '')
  if (!value) return null
  if (value.includes(',') && value.includes('.')) value = value.replace(/,/g, '')
  else if (value.includes(',')) value = value.replace(',', '.')
  if (!/^-?\d*(\.\d*)?$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** La medición solo acepta dígitos y un punto decimal. */
export function sanitizeMeasurementInput(raw: string): string {
  const digitsAndDots = raw.replace(/[^0-9.]/g, '')
  const firstDot = digitsAndDots.indexOf('.')
  if (firstDot < 0) return digitsAndDots
  return (
    digitsAndDots.slice(0, firstDot + 1) + digitsAndDots.slice(firstDot + 1).replaceAll('.', '')
  )
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** m³ con los decimales pedidos (3 por defecto), para no perder precisión visual. */
export function formatM3(value: number, decimals = 3): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatLiters(value: number): string {
  return `${formatNumber(Math.round(value), 0)} L`
}

export function formatLph(value: number): string {
  return `${formatNumber(roundTo(value, 1), 1)} L/h`
}

/** El total se redondea hacia arriba al colón: nunca prometemos centavos. */
export function formatMoney(value: number): string {
  const rounded = Math.ceil(value - 1e-9)
  const normalized = Object.is(rounded, -0) ? 0 : rounded
  if (normalized < 0) return `-₡${formatNumber(Math.abs(normalized), 0)}`
  return `₡${formatNumber(normalized, 0)}`
}

export function formatMoneyShort(value: number): string {
  const rounded = Math.ceil(value - 1e-9)
  if (Math.abs(rounded) >= 1_000_000) return `₡${formatNumber(rounded / 1_000_000, 1)} M`
  if (Math.abs(rounded) >= 10_000) return `₡${formatNumber(rounded / 1000, 1)} mil`
  return formatMoney(value)
}

export function formatMultiplier(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${formatNumber(roundTo(value, 1), 1)}×`
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(roundTo(value, 0), 0)}%`
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export const DECIMALS = { m3: 3, liters: 0, flow: 1, money: 0 } as const
