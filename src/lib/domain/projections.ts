import type { Cycle, DayPoint, Projection, ProjectionScenario, Reading, Settings } from './types'
import { calcBill, metersToThreshold } from './billing'
import { cycleDayProgress, expectedCycleEnd, lastReadingInCycle } from './cycles'
import { addDays, dayKey, parseReadingDate, todayKey } from './dates'
import { mean } from './stats'

export type ProjectionContext = {
  cycle: Cycle
  readings: Reading[]
  days: DayPoint[]
  settings: Settings
  now?: Date
}

function projectedReading(
  baseValue: number,
  exactM3: number,
  rateM3PerDay: number,
  remainingDays: number,
): number {
  return baseValue + exactM3 + rateM3PerDay * remainingDays
}

function crossDate(
  currentBillableM3: number,
  rateM3PerDay: number,
  remainingDays: number,
  now: Date,
): string | null {
  if (rateM3PerDay <= 0) return null
  if (currentBillableM3 > 30) return null
  const neededDays = (30 - currentBillableM3) / rateM3PerDay
  if (neededDays > remainingDays) return null
  return dayKey(addDays(now, Math.ceil(neededDays)))
}

/**
 * Tres escenarios de proyección: promedio del ciclo, últimos 7 días y peor día.
 * La factura es referencia secundaria; el foco es la anomalía diaria.
 */
export function buildProjection(context: ProjectionContext): Projection | null {
  const { cycle, readings, days, settings } = context
  const now = context.now ?? new Date()
  const last = lastReadingInCycle(readings, cycle)
  const progress = cycleDayProgress(cycle, settings.cycleDay, now)

  const base = cycle.baseValue
  const currentReading = last?.value ?? base
  const currentExactM3 = Math.max(0, currentReading - base)
  const currentBillableM3 = Math.max(0, Math.floor(currentReading + 1e-9) - Math.floor(base + 1e-9))
  const currentBill = calcBill(currentBillableM3, settings.tariffs)

  const elapsed = Math.max(progress.elapsedDays, 1 / 24)
  const remaining = progress.remainingDays
  const averageRate = currentExactM3 / elapsed

  const recent = days.slice(-7)
  const recentRateLpd = recent.length > 0 ? mean(recent.map((day) => day.litersPerDay)) : 0
  // El peor escenario debe salir del ciclo actual, no de ciclos viejos.
  const cycleDays = days.filter((day) => day.day >= dayKey(cycle.startAt))
  const worstSource = cycleDays.length > 0 ? cycleDays : days
  const worstRateLpd =
    worstSource.length > 0 ? Math.max(...worstSource.map((day) => day.litersPerDay)) : 0

  const scenario = (
    id: ProjectionScenario['id'],
    label: string,
    rateLitersPerDay: number,
  ): ProjectionScenario => {
    const rateM3PerDay = rateLitersPerDay / 1000
    const projectedM3 = projectedReading(base, currentExactM3, rateM3PerDay, remaining) - base
    const readingAtClose = base + projectedM3
    const billableM3 = Math.max(0, Math.floor(readingAtClose + 1e-9) - Math.floor(base + 1e-9))
    const bill = calcBill(billableM3, settings.tariffs)
    return {
      id,
      label,
      rateLitersPerDay,
      projectedM3,
      billableM3,
      bill,
      crossesIvaThreshold: bill.crossesIvaThreshold,
      ivaCrossDate: crossDate(currentBillableM3, rateM3PerDay, remaining, now),
    }
  }

  const scenarios = [
    scenario('average', 'Promedio del ciclo', averageRate * 1000),
    scenario('recent', 'Últimos 7 días', recentRateLpd),
    scenario('worst', 'Peor día del ciclo', worstRateLpd),
  ]

  const worst = scenarios.reduce(
    (max, item) => (item.bill.total > max.bill.total ? item : max),
    scenarios[0],
  )

  return {
    cycle,
    elapsedDays: progress.elapsedDays,
    remainingDays: remaining,
    currentExactM3,
    currentBillableM3,
    currentBill,
    scenarios,
    worst,
    m3ToNextThreshold: metersToThreshold(currentBillableM3),
    overdueDays: progress.overdueDays,
  }
}

export function cycleAverageLitersPerDay(cycle: Cycle, readings: Reading[]): number | null {
  const last = lastReadingInCycle(readings, cycle)
  if (!last) return null
  const start = parseReadingDate(cycle.startAt)
  const hours = (Date.now() - start.getTime()) / 3_600_000
  if (hours <= 0) return null
  return ((last.value - cycle.baseValue) * 1000) / (hours / 24)
}

export function expectedEndLabel(cycle: Cycle, settings: Settings): string {
  return expectedCycleEnd(cycle, settings.cycleDay)
}

export function todayLabel(now: Date = new Date()): string {
  return todayKey(now)
}
