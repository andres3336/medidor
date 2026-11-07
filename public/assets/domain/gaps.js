import { dayKey, dayKeysBetween, hoursBetween, todayKey, yesterdayKey } from './dates.js'
import { lastReading } from './readings.js'
import { GAP_WARN_HOURS } from './constants.js'

export function findGaps(readings, cycle, now = new Date()) {
  const last = lastReading(
    readings.filter((reading) => Date.parse(reading.at) >= Date.parse(cycle.startAt)),
  )
  const daysWithReading = new Set(readings.map((reading) => dayKey(reading.at)))

  const startDay = dayKey(cycle.startAt)
  const endDay = yesterdayKey(now)
  const range = startDay <= endDay ? dayKeysBetween(startDay, endDay) : []
  const missingDays = range.filter((day) => !daysWithReading.has(day))

  const hoursSinceLast = last ? hoursBetween(last.at, now) : null
  const stale = hoursSinceLast != null && hoursSinceLast > GAP_WARN_HOURS
  const today = todayKey(now)
  const missingYesterday = startDay < today && !daysWithReading.has(yesterdayKey(now))

  const severity = stale ? 'danger' : missingDays.length > 0 || missingYesterday ? 'warn' : 'ok'

  return {
    missingDays,
    lastReadingAt: last?.at ?? null,
    hoursSinceLast,
    missingYesterday,
    severity,
  }
}
