import { dayKey, hoursBetween } from './dates.js'
import { roundTo, truncate3 } from './format.js'

export function readingKey(at, value) {
  return `${at}|${value.toFixed(3)}`
}

export function makeReading(input) {
  return {
    id: `r-${Date.parse(input.at)}-${truncate3(input.value).toFixed(3)}`,
    at: input.at,
    value: truncate3(input.value),
    note: input.note?.trim() ?? '',
  }
}

export function sortReadings(readings) {
  return [...readings].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/** Deduplicates by `fecha|medicion`; the last row read wins. */
export function dedupeReadings(readings) {
  const seen = new Map()
  for (const reading of sortReadings(readings)) {
    seen.set(readingKey(reading.at, reading.value), reading)
  }
  return [...seen.values()]
}

/** Consecutive intervals between sorted readings. */
export function buildIntervals(readings) {
  const sorted = sortReadings(readings)
  const intervals = []
  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1]
    const to = sorted[index]
    const deltaM3 = to.value - from.value
    const hours = hoursBetween(from.at, to.at)
    intervals.push({
      from,
      to,
      deltaM3,
      liters: deltaM3 * 1000,
      hours,
      lph: hours > 0 ? (deltaM3 * 1000) / hours : Number.NaN,
    })
  }
  return intervals
}

export function lastReading(readings) {
  const sorted = sortReadings(readings)
  return sorted.length === 0 ? null : sorted[sorted.length - 1]
}

export function firstReading(readings) {
  const sorted = sortReadings(readings)
  return sorted.length === 0 ? null : sorted[0]
}

/**
 * Normalized daily series: the last reading of each day against the last
 * reading of the previous day WITH data. Gaps do not create fake peaks: they
 * are divided by the real hours of the interval.
 */
export function buildDailySeries(readings) {
  const sorted = sortReadings(readings)
  const byDay = new Map()
  for (const reading of sorted) byDay.set(dayKey(reading.at), reading)

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
  const points = []

  for (let index = 1; index < days.length; index += 1) {
    const [day, current] = days[index]
    const [, previous] = days[index - 1]
    const hours = hoursBetween(previous.at, current.at)
    if (hours <= 0) continue
    const liters = (current.value - previous.value) * 1000
    const gapDays = Math.max(0, Math.round(hours / 24) - 1)
    points.push({
      day,
      at: current.at,
      reading: current.value,
      liters,
      hours,
      litersPerDay: liters / (hours / 24),
      gapDays,
      note: current.note,
    })
  }

  return points.map((point) => ({ ...point, litersPerDay: roundTo(point.litersPerDay, 1) }))
}

export function findDayPoint(points, day) {
  return points.find((point) => point.day === day) ?? null
}

/** Last complete interval, for when there is no reading from yesterday. */
export function lastInterval(intervals) {
  return intervals.length === 0 ? null : intervals[intervals.length - 1]
}

export function readingsInRange(readings, fromIso, toIsoValue) {
  const from = Date.parse(fromIso)
  const to = Date.parse(toIsoValue)
  return sortReadings(readings).filter((reading) => {
    const time = Date.parse(reading.at)
    return time >= from && time <= to
  })
}
