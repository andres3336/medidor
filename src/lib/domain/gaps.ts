import type { Cycle, Reading } from './types'
import { dayKey, dayKeysBetween, hoursBetween, todayKey, yesterdayKey } from './dates'
import { lastReading } from './readings'
import { GAP_WARN_HOURS } from './constants'

export type GapStatus = {
  /** Días calendario sin ninguna medición dentro del ciclo actual */
  missingDays: string[]
  lastReadingAt: string | null
  hoursSinceLast: number | null
  missingYesterday: boolean
  severity: 'ok' | 'warn' | 'danger'
}

export function findGaps(readings: Reading[], cycle: Cycle, now: Date = new Date()): GapStatus {
  const active = readings.filter((reading) => !reading.deleted)
  const last = lastReading(
    active.filter((reading) => Date.parse(reading.at) >= Date.parse(cycle.startAt)),
  )
  const daysWithReading = new Set(active.map((reading) => dayKey(reading.at)))

  const startDay = dayKey(cycle.startAt)
  const endDay = yesterdayKey(now)
  const range = startDay <= endDay ? dayKeysBetween(startDay, endDay) : []
  const missingDays = range.filter((day) => !daysWithReading.has(day))

  const hoursSinceLast = last ? hoursBetween(last.at, now) : null
  const stale = hoursSinceLast != null && hoursSinceLast > GAP_WARN_HOURS
  const today = todayKey(now)
  const missingYesterday = startDay < today && !daysWithReading.has(yesterdayKey(now))

  const severity: GapStatus['severity'] = stale
    ? 'danger'
    : missingDays.length > 0 || missingYesterday
      ? 'warn'
      : 'ok'

  return {
    missingDays,
    lastReadingAt: last?.at ?? null,
    hoursSinceLast,
    missingYesterday,
    severity,
  }
}
