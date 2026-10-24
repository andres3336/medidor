import type { Cycle, Reading, Settings } from './types'
import { dayKey, dayKeysBetween, hoursBetween, todayKey, yesterdayKey } from './dates'
import { lastReading } from './readings'

export type GapStatus = {
  /** días calendario sin ninguna lectura, dentro del ciclo actual */
  missingDays: string[]
  unacknowledged: string[]
  lastReadingAt: string | null
  hoursSinceLast: number | null
  severity: 'ok' | 'warn' | 'danger'
  /** "no hay lectura de ayer" cuando aplica */
  missingYesterday: boolean
}

/**
 * Días faltantes: el "super error" del proyecto.
 * Solo cuenta días completos: el día de hoy todavía puede recibir lectura.
 */
export function findGaps(
  readings: Reading[],
  cycle: Cycle,
  settings: Settings,
  now: Date = new Date(),
): GapStatus {
  const active = readings.filter((reading) => !reading.deleted)
  const last = lastReading(
    active.filter((reading) => Date.parse(reading.at) >= Date.parse(cycle.startAt)),
  )
  const daysWithReading = new Set(active.map((reading) => dayKey(reading.at)))

  const startDay = dayKey(cycle.startAt)
  const endDay = yesterdayKey(now)
  const range = startDay <= endDay ? dayKeysBetween(startDay, endDay) : []
  const missingDays = range.filter((day) => !daysWithReading.has(day))
  const unacknowledged = missingDays.filter((day) => !settings.acknowledgedGaps.includes(day))

  const hoursSinceLast = last ? hoursBetween(last.at, now) : null
  const stale = hoursSinceLast != null && hoursSinceLast > settings.gapWarnHours
  const today = todayKey(now)
  // Un ciclo que empezó hoy no puede exigir lectura de ayer.
  const missingYesterday = startDay < today && !daysWithReading.has(yesterdayKey(now))

  const severity: GapStatus['severity'] =
    unacknowledged.length > 0 || stale ? 'danger' : missingDays.length > 0 ? 'warn' : 'ok'

  return {
    missingDays,
    unacknowledged,
    lastReadingAt: last?.at ?? null,
    hoursSinceLast,
    severity,
    missingYesterday,
  }
}

export function alertTitle(gaps: GapStatus): string {
  if (gaps.unacknowledged.length > 1) {
    return `Sin lectura desde hace ${gaps.unacknowledged.length} días`
  }
  if (gaps.missingYesterday) return 'ALERTA: no hay lectura de ayer'
  if (gaps.unacknowledged.length === 1) return 'Falta la lectura de un día'
  return 'Lecturas al día'
}

export function alertDetail(gaps: GapStatus): string {
  if (gaps.unacknowledged.length === 0) {
    if (gaps.hoursSinceLast == null) return 'Todavía no hay lecturas en este ciclo.'
    return `Última lectura hace ${Math.round(gaps.hoursSinceLast)} h.`
  }
  return `Días sin lectura: ${gaps.unacknowledged.join(', ')}.`
}
