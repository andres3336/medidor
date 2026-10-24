import type { Cycle, DayPoint, Projection, Reading, Tariffs } from './types'
import { billableConsumption, calcBill, metersToThreshold } from './billing'
import { cycleDayProgress, lastReadingInCycle } from './cycles'
import { hoursBetween } from './dates'
import { mean } from './stats'
import { PROJECTION_WINDOW_DAYS } from './constants'

export type ProjectionContext = {
  cycle: Cycle
  readings: Reading[]
  days: DayPoint[]
  tariffs: Tariffs
  now?: Date
}

/**
 * Una sola proyección: promedio L/día de los últimos días del ciclo,
 * extrapolado hasta la fecha de corte. Es el "what-if" sin sliders.
 */
export function buildProjection(context: ProjectionContext): Projection | null {
  const { cycle, readings, days, tariffs } = context
  const now = context.now ?? new Date()
  if (cycle.baseValue == null) return null

  const base = cycle.baseValue
  const last = lastReadingInCycle(readings, cycle)
  const currentReading = last?.value ?? base
  const currentExactM3 = Math.max(0, currentReading - base)
  const currentBillableM3 = Math.max(0, billableConsumption(currentReading, base))
  const currentBill = calcBill(currentBillableM3, tariffs)
  const progress = cycleDayProgress(cycle, now)

  const cycleDays = days.filter(
    (day) => day.day >= cycle.startAt.slice(0, 10) && day.day < cycle.endAt.slice(0, 10),
  )
  const recent = cycleDays.slice(-PROJECTION_WINDOW_DAYS)
  const fallbackRate = progress.elapsedDays > 0 ? (currentExactM3 * 1000) / progress.elapsedDays : 0
  const rateLitersPerDay =
    recent.length > 0 ? mean(recent.map((day) => day.litersPerDay)) : fallbackRate

  const remainingDays = last ? Math.max(0, hoursBetween(last.at, cycle.endAt) / 24) : 0
  const projectedM3 = currentExactM3 + (rateLitersPerDay * remainingDays) / 1000
  const projectedReading = base + projectedM3
  const projectedBillableM3 = Math.max(0, billableConsumption(projectedReading, base))
  const projectedBill = calcBill(projectedBillableM3, tariffs)

  return {
    cycle,
    elapsedDays: progress.elapsedDays,
    remainingDays,
    currentExactM3,
    currentBillableM3,
    currentBill,
    rateLitersPerDay,
    rateSampleDays: recent.length,
    projectedM3,
    projectedBillableM3,
    projectedBill,
    m3ToNextThreshold: metersToThreshold(currentBillableM3),
    overdueDays: progress.overdueDays,
  }
}

export function cycleAverageLitersPerDay(cycle: Cycle, readings: Reading[]): number | null {
  if (cycle.baseValue == null) return null
  const last = lastReadingInCycle(readings, cycle)
  if (!last) return null
  const hours = hoursBetween(cycle.startAt, last.at)
  if (hours <= 0) return null
  return ((last.value - cycle.baseValue) * 1000) / (hours / 24)
}
