import { billableConsumption, calcBill, metersToThreshold } from './billing.js'
import { cycleDayProgress, lastReadingInCycle } from './cycles.js'
import { hoursBetween } from './dates.js'
import { mean } from './stats.js'
import { HOUSE1_BASELINE_LPD, HOUSE2_LEAK_LPD, PROJECTION_WINDOW_DAYS } from './constants.js'

/**
 * A single projection: average L/day from the last days of the cycle,
 * extrapolated to the cutoff date. It is the "what-if" without sliders.
 */
export function buildProjection(context) {
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
    waste: buildWasteEstimate({
      currentExactM3,
      elapsedDays: progress.elapsedDays,
      totalDays: progress.totalDays,
      projectedM3,
      projectedBill,
      tariffs,
    }),
  }
}

/**
 * Estimated waste: the cycle with House 1 alone against the pace the meter is
 * actually showing. The House 1 baseline and the House 2 leak are fixed
 * estimates; the colón difference uses exact totals and is rounded only when
 * displayed, like every other amount in the app.
 */
export function buildWasteEstimate(context) {
  const { currentExactM3, elapsedDays, totalDays, projectedM3, projectedBill, tariffs } = context

  const baselineDailyM3 = HOUSE1_BASELINE_LPD / 1000
  const baselineCycleM3 = (HOUSE1_BASELINE_LPD * totalDays) / 1000
  const baselineBillableM3 = Math.max(0, Math.floor(baselineCycleM3 + 1e-9))
  const baselineBill = calcBill(baselineBillableM3, tariffs)
  const leakDailyM3 = HOUSE2_LEAK_LPD / 1000
  const leakCycleM3 = (HOUSE2_LEAK_LPD * totalDays) / 1000
  const baselineSoFarM3 = (HOUSE1_BASELINE_LPD * elapsedDays) / 1000

  return {
    baselineDailyM3,
    baselineCycleM3,
    baselineBillableM3,
    baselineBill,
    leakDailyM3,
    leakCycleM3,
    excessSoFarM3: Math.max(0, currentExactM3 - baselineSoFarM3),
    projectedWasteM3: Math.max(0, projectedM3 - baselineCycleM3),
    projectedWasteColon: Math.max(0, projectedBill.total - baselineBill.total),
  }
}

export function cycleAverageLitersPerDay(cycle, readings) {
  if (cycle.baseValue == null) return null
  const last = lastReadingInCycle(readings, cycle)
  if (!last) return null
  const hours = hoursBetween(cycle.startAt, last.at)
  if (hours <= 0) return null
  return ((last.value - cycle.baseValue) * 1000) / (hours / 24)
}
