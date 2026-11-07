import { currentCycle, buildCycles, lastReadingInCycle } from './cycles.js'
import { dayKey, todayKey } from './dates.js'
import { findGaps } from './gaps.js'
import { computeBaseline, detectAnomalies } from './anomalies.js'
import { buildProjection, cycleAverageLitersPerDay } from './projections.js'
import { BASELINE_WINDOW_DAYS } from './constants.js'
import { buildDailySeries, buildIntervals } from './readings.js'
import { billableConsumption, calcBill } from './billing.js'
import { ARESEP_TARIFFS_2026_10_23 } from './tariffs.js'

/**
 * Everything the page needs, derived in memory from the readings.
 * Nothing here is persisted: it is recalculated on every sync.
 */
export function deriveAnalytics(state, now = new Date()) {
  const readings = state.readings
  const cycles = buildCycles(readings, now)
  const cycle = currentCycle(cycles, now) ?? cycles[0]
  const start = Date.parse(cycle.startAt)
  const end = Date.parse(cycle.endAt)

  const intervals = buildIntervals(readings)
  const days = buildDailySeries(readings)
  const cycleDays = days.filter((day) => {
    const time = Date.parse(day.at)
    return time >= start && time < end
  })

  const last = lastReadingInCycle(readings, cycle)
  const currentReading = last?.value ?? cycle.baseValue ?? 0
  const billableM3 =
    cycle.baseValue == null ? 0 : Math.max(0, billableConsumption(currentReading, cycle.baseValue))
  const currentBill = calcBill(billableM3, ARESEP_TARIFFS_2026_10_23)

  const anomalies = cycles.flatMap((item) => {
    const itemDays = days.filter((day) => {
      const time = Date.parse(day.at)
      return time >= Date.parse(item.startAt) && time < Date.parse(item.endAt)
    })
    const windowDays = itemDays.slice(-BASELINE_WINDOW_DAYS)
    if (windowDays.length === 0) return []
    const itemBaseline = computeBaseline(windowDays, cycleAverageLitersPerDay(item, readings))
    return detectAnomalies(windowDays, itemBaseline)
  })

  const projection = buildProjection({
    cycle,
    readings,
    days,
    tariffs: ARESEP_TARIFFS_2026_10_23,
    now,
  })

  const gaps = findGaps(readings, cycle, now)
  const today = todayKey(now)
  const hasReadingToday = readings.some((reading) => dayKey(reading.at) === today)
  const averageM3PerDay =
    projection && projection.elapsedDays > 0
      ? projection.currentExactM3 / projection.elapsedDays
      : null

  const cycleIndex = cycles.findIndex((item) => item.id === cycle.id)
  const previousCycle = cycleIndex > 0 ? cycles[cycleIndex - 1] : null
  const previousAverageLitersPerDay = previousCycle
    ? cycleAverageLitersPerDay(previousCycle, readings)
    : null
  const previousCycleAverageM3PerDay =
    previousAverageLitersPerDay == null ? null : previousAverageLitersPerDay / 1000

  return {
    readings,
    cycles,
    cycle,
    days,
    cycleDays,
    intervals,
    anomalies,
    projection,
    gaps,
    currentBill,
    billableM3,
    lastReading: last,
    hasReadingToday,
    averageM3PerDay,
    previousCycleAverageM3PerDay,
  }
}
