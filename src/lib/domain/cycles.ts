import type { Cycle, Reading } from './types'
import { dayKey, formatDayMonth, hoursBetween, startOfDay, toIso } from './dates'
import { activeReadings } from './readings'
import { CYCLE_DAY } from './constants'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Inicio del ciclo que contiene la fecha: el día 20 a las 00:00 de Costa Rica. */
export function periodStartFor(input: string | Date): string {
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

export function nextPeriodStart(startAt: string): string {
  const [year, month] = dayKey(startAt).split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return toIso(startOfDay(`${nextYear}-${pad(nextMonth)}-${pad(CYCLE_DAY)}`))
}

export function periodIdFor(startAt: string): string {
  return dayKey(startAt).slice(0, 7)
}

export function cycleLabelFor(startAt: string): string {
  return `${formatDayMonth(startAt)} – ${formatDayMonth(nextPeriodStart(startAt))}`
}

function makeCycle(
  startAt: string,
  inCycle: Reading[],
  baseReading: Reading | null,
  now: Date,
): Cycle {
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
 * Deriva los ciclos 20 → 20 a partir de las mediciones.
 *
 * La base de un ciclo es la última medición ANTERIOR al día 20 a las 00:00.
 * Si no hay ninguna (primer ciclo), se usa la primera medición del ciclo.
 * No se persisten ciclos ni bases: editar una medición recalcula todo.
 */
export function buildCycles(readings: Reading[], now: Date = new Date()): Cycle[] {
  const active = activeReadings(readings)
  const currentStart = periodStartFor(now)

  if (active.length === 0) {
    return [makeCycle(currentStart, [], null, now)]
  }

  const firstStart = periodStartFor(active[0].at)
  const cycles: Cycle[] = []
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

export function currentCycle(cycles: Cycle[], now: Date = new Date()): Cycle | null {
  const time = now.getTime()
  return (
    cycles.find((cycle) => Date.parse(cycle.startAt) <= time && time < Date.parse(cycle.endAt)) ??
    cycles[cycles.length - 1] ??
    null
  )
}

export function cycleReadings(readings: Reading[], cycle: Cycle): Reading[] {
  const start = Date.parse(cycle.startAt)
  const end = Date.parse(cycle.endAt)
  return activeReadings(readings).filter((reading) => {
    const time = Date.parse(reading.at)
    return time >= start && time < end
  })
}

export function lastReadingInCycle(readings: Reading[], cycle: Cycle): Reading | null {
  const inCycle = cycleReadings(readings, cycle)
  return inCycle.length === 0 ? null : inCycle[inCycle.length - 1]
}

/** Días transcurridos y restantes dentro de la ventana 20 → 20. */
export function cycleDayProgress(cycle: Cycle, now: Date = new Date()) {
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
