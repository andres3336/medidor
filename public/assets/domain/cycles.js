import { dayKey, formatDayMonth, hoursBetween, startOfDay, toIso } from './dates.js'
import { sortReadings } from './readings.js'
import { CYCLE_DAY } from './constants.js'

function pad(value) {
  return String(value).padStart(2, '0')
}

/** Start of the cycle that contains the date: the 20th at 00:00 Costa Rica time. */
export function periodStartFor(input) {
  const key = dayKey(input)
  const parts = key.split('-').map(Number)
  let year = parts[0]
  let month = parts[1]
  const day = parts[2]
  if (day < CYCLE_DAY) {
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return toIso(startOfDay(`${year}-${pad(month)}-${pad(CYCLE_DAY)}`))
}

export function nextPeriodStart(startAt) {
  const [year, month] = dayKey(startAt).split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return toIso(startOfDay(`${nextYear}-${pad(nextMonth)}-${pad(CYCLE_DAY)}`))
}

export function periodIdFor(startAt) {
  return dayKey(startAt).slice(0, 7)
}

export function cycleLabelFor(startAt) {
  return `${formatDayMonth(startAt)} – ${formatDayMonth(nextPeriodStart(startAt))}`
}

function makeCycle(startAt, inCycle, baseReading, now) {
  const endAt = nextPeriodStart(startAt)
  const last = inCycle[inCycle.length - 1] ?? null
  return {
    id: periodIdFor(startAt),
    label: cycleLabelFor(startAt),
    startAt,
    endAt,
    baseValue: baseReading?.value ?? null,
    baseReadingAt: baseReading?.at ?? null,
    finalReading: last?.value ?? null,
    finalReadingAt: last?.at ?? null,
    readingsCount: inCycle.length,
    open: now.getTime() < Date.parse(endAt),
  }
}

/**
 * Derives the 20 → 20 cycles from the readings.
 *
 * A cycle's base is the last reading BEFORE the 20th at 00:00.
 * If there is none (first cycle), the first reading of the cycle is used.
 * Cycles and bases are not persisted: editing a reading recalculates everything.
 */
export function buildCycles(readings, now = new Date()) {
  const active = sortReadings(readings)
  const currentStart = periodStartFor(now)

  if (active.length === 0) {
    return [makeCycle(currentStart, [], null, now)]
  }

  const firstStart = periodStartFor(active[0].at)
  const cycles = []
  let cursor = Date.parse(firstStart) > Date.parse(currentStart) ? currentStart : firstStart
  const lastStart = Date.parse(currentStart)

  for (let guard = 0; guard < 240; guard += 1) {
    const startMs = Date.parse(cursor)
    const endAt = nextPeriodStart(cursor)
    const endMs = Date.parse(endAt)
    const inCycle = active.filter((reading) => {
      const time = Date.parse(reading.at)
      return time >= startMs && time < endMs
    })
    const before = active.filter((reading) => Date.parse(reading.at) < startMs)
    const baseReading = before[before.length - 1] ?? inCycle[0] ?? null
    cycles.push(makeCycle(cursor, inCycle, baseReading, now))
    if (startMs >= lastStart) break
    cursor = endAt
  }

  return cycles
}

export function currentCycle(cycles, now = new Date()) {
  const time = now.getTime()
  return (
    cycles.find((cycle) => Date.parse(cycle.startAt) <= time && time < Date.parse(cycle.endAt)) ??
    cycles[cycles.length - 1] ??
    null
  )
}

export function cycleReadings(readings, cycle) {
  const start = Date.parse(cycle.startAt)
  const end = Date.parse(cycle.endAt)
  return sortReadings(readings).filter((reading) => {
    const time = Date.parse(reading.at)
    return time >= start && time < end
  })
}

export function lastReadingInCycle(readings, cycle) {
  const inCycle = cycleReadings(readings, cycle)
  return inCycle.length === 0 ? null : inCycle[inCycle.length - 1]
}

/** Elapsed and remaining days inside the 20 → 20 window. */
export function cycleDayProgress(cycle, now = new Date()) {
  const start = cycle.startAt
  const end = cycle.endAt
  const elapsed = Math.max(0, hoursBetween(start, now) / 24)
  const total = Math.max(1, hoursBetween(start, end) / 24)
  return {
    elapsedDays: Math.min(elapsed, total),
    remainingDays: Math.max(0, total - elapsed),
    totalDays: total,
    overdueDays: Math.max(0, Math.floor(elapsed - total)),
  }
}
