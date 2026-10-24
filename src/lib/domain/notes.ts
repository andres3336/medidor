import type { Interval, LeakSignal, Settings } from './types'
import { roundTo } from './format'

const LITER_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:l|lt|lts|litro|litros)\b/gi
const BARE_CUBIC_METERS = /(?:^|[^\d])(0[.,]\d{3,4})(?!\d)/g
const SPINNING =
  /(sigue|siguen|seguia|seguía|estaba|está|esta)\s+(dando\s+vueltas|girando|corriendo)|da\s+vueltas|dando\s+vueltas|girando|(medidor)\s+(sigue|sigue\s+dando)/i
const EXPECTS_ZERO =
  /deber[ií]a\s+(de\s+)?ser\s+0|deberia\s+(de\s+)?ser\s+0|casa\s+sin\s+uso|sin\s+uso|nadie\s+en\s+casa|no\s+hay\s+nadie|no\s+se\s+ha\s+usado/i
const NO_WATER = /no\s+hubo\s+agua|sin\s+agua|se\s+cort[oó]\s+el\s+agua/i
const STORED = /guard[oó]|almacen[oó]|llen[oó]\s+(el\s+)?(tanque|barril|paila)|se\s+guard/i

export type NoteQuantities = {
  liters: number
  /** valores tal como aparecen, para mostrar en la UI */
  parts: string[]
  spinning: boolean
  expectsZero: boolean
  noWater: boolean
  stored: boolean
}

/**
 * Extrae cantidades de la nota:
 * - `6 litros`, `20L+5L+10L` → litros
 * - `0.004` con 3+ decimales → m³ (equivale a 4 L)
 */
export function parseNoteQuantities(note: string): NoteQuantities {
  const parts: string[] = []
  let liters = 0

  for (const match of note.matchAll(LITER_PATTERN)) {
    const value = Number(match[1].replace(',', '.'))
    if (!Number.isFinite(value)) continue
    liters += value
    parts.push(match[0].trim())
  }

  if (parts.length === 0) {
    for (const match of note.matchAll(BARE_CUBIC_METERS)) {
      const value = Number(match[1].replace(',', '.'))
      if (!Number.isFinite(value)) continue
      liters += value * 1000
      parts.push(`${match[1]} m³`)
    }
  }

  return {
    liters: roundTo(liters, 1),
    parts,
    spinning: SPINNING.test(note),
    expectsZero: EXPECTS_ZERO.test(note),
    noWater: NO_WATER.test(note),
    stored: STORED.test(note),
  }
}

/**
 * Señales de fuga a partir de la nota vs lo que marcó el medidor.
 * Requiere que la nota hable de cantidades o de que el medidor sigue girando:
 * una nota "medición diaria" no genera ruido.
 */
export function detectLeakSignals(intervals: Interval[], settings: Settings): LeakSignal[] {
  const signals: LeakSignal[] = []

  for (const interval of intervals) {
    if (!Number.isFinite(interval.lph) || interval.hours <= 0) continue
    const note = interval.to.note
    const quantities = parseNoteQuantities(note)
    const hasQuantity = quantities.parts.length > 0
    if (!hasQuantity && !quantities.spinning && !quantities.expectsZero) continue

    const measuredLiters = Math.max(0, interval.liters)
    const unexplained = Math.max(0, measuredLiters - quantities.liters)
    const lph = unexplained / interval.hours
    const threshold = settings.note.unexplainedWarnLiters

    if (unexplained < threshold && !quantities.spinning && !quantities.expectsZero) continue

    const observedLph = measuredLiters / interval.hours
    const effectiveLph = quantities.expectsZero && unexplained < threshold ? observedLph : lph

    const kind: LeakSignal['kind'] =
      quantities.expectsZero && unexplained < threshold
        ? 'expected-zero'
        : quantities.spinning
          ? 'meter-spinning'
          : quantities.stored
            ? 'stored-water'
            : 'unexplained'

    const severity: LeakSignal['severity'] =
      effectiveLph >= settings.flow.dangerLph || unexplained >= 100
        ? 'danger'
        : effectiveLph >= settings.flow.warningLph || unexplained >= threshold
          ? 'warn'
          : 'info'

    signals.push({
      at: interval.to.at,
      note,
      explainedLiters: quantities.liters,
      measuredLiters,
      unexplainedLiters: roundTo(unexplained, 1),
      lph: roundTo(effectiveLph, 1),
      kind,
      severity,
    })
  }

  return signals
}

/** Texto corto y accionable para una señal. */
export function leakSignalText(signal: LeakSignal): string {
  if (signal.kind === 'expected-zero') {
    return `La nota esperaba 0 L, pero el medidor marcó ${Math.round(
      signal.measuredLiters,
    )} L ≈ ${signal.lph} L/h con la casa sin uso.`
  }
  if (signal.kind === 'meter-spinning' && signal.unexplainedLiters <= 0) {
    return 'La nota dice que el medidor sigue girando: revisá llave-ducha y casa2.'
  }
  if (signal.explainedLiters <= 0) {
    return `La nota no explica ${Math.round(signal.measuredLiters)} L del intervalo.`
  }
  return `La nota explica ${Math.round(signal.explainedLiters)} L, pero el medidor marcó ${Math.round(
    signal.measuredLiters,
  )} L → ${Math.round(signal.unexplainedLiters)} L no explicados.`
}

/** Acción sugerida según el vocabulario de las notas y tags. */
export function suggestedAction(text: string): string {
  const normalized = text.toLowerCase()
  const places: string[] = []
  if (normalized.includes('ducha')) places.push('llave-ducha')
  if (normalized.includes('alfonso')) places.push('llave-alfonso')
  if (normalized.includes('casa2') || normalized.includes('casa 2')) places.push('casa2')
  if (normalized.includes('casa1') || normalized.includes('casa 1')) places.push('casa1')
  if (places.length > 0) return `Revisá ${places.join(' y ')}`
  return 'Revisá llave-medidor y el medidor'
}
