import type {
  Anomaly,
  AppState,
  Baseline,
  Bill,
  Cycle,
  DayPoint,
  FlowStats,
  LeakSignal,
  Projection,
  Reading,
} from '../domain/types'
import { buildConclusions } from '../domain/conclusions'
import { currentCycle, cycleReadings, isCloseDue, lastReadingInCycle } from '../domain/cycles'
import { dayKey, hoursBetween, yesterdayKey } from '../domain/dates'
import { findGaps, type GapStatus } from '../domain/gaps'
import { computeFlowStats } from '../domain/flow'
import { detectLeakSignals } from '../domain/notes'
import { computeBaseline, dayCost, detectAnomalies, isDailyOutlier } from '../domain/anomalies'
import { buildProjection } from '../domain/projections'
import { buildDailySeries, buildIntervals, findDayPoint, lastReading } from '../domain/readings'
import { calcBill } from '../domain/billing'
import type { Conclusion as ConclusionType } from '../domain/conclusions'

export type CycleHistoryRow = {
  cycle: Cycle
  last: Reading | null
  exactM3: number
  billableM3: number
  bill: Bill | null
  difference: number | null
}

export type Analytics = {
  readings: Reading[]
  cycle: Cycle
  cycles: Cycle[]
  days: DayPoint[]
  cycleDays: DayPoint[]
  intervals: ReturnType<typeof buildIntervals>
  baseline: Baseline
  anomalies: Anomaly[]
  leaks: LeakSignal[]
  flow: FlowStats
  projection: Projection | null
  gaps: GapStatus
  yesterday: DayPoint | null
  yesterdayCost: number | null
  previousCost: number | null
  yesterdayIsOutlier: boolean
  conclusions: ConclusionType[]
  closeDue: boolean
  history: CycleHistoryRow[]
  billableM3: number
  currentBill: Bill
}

function cycleAverageLitersPerDay(cycle: Cycle, readings: Reading[]): number | null {
  const last = lastReadingInCycle(readings, cycle)
  if (!last) return null
  const hours = hoursBetween(cycle.startAt, last.at)
  if (hours <= 0) return null
  return ((last.value - cycle.baseValue) * 1000) / (hours / 24)
}

export function deriveAnalytics(state: AppState, now: Date = new Date()): Analytics {
  const cycle = currentCycle(state.cycles)
  if (!cycle) throw new Error('No hay ciclos configurados')

  const readings = state.readings.filter((reading) => !reading.deleted)
  const intervals = buildIntervals(readings)
  const days = buildDailySeries(readings)
  const cycleDays = days.filter((day) => dayKey(day.at) >= dayKey(cycle.startAt))

  const last = lastReading(readings)
  const currentReading = last?.value ?? cycle.baseValue
  const billableM3 = Math.max(
    0,
    Math.floor(currentReading + 1e-9) - Math.floor(cycle.baseValue + 1e-9),
  )
  const currentBill = calcBill(billableM3, state.settings.tariffs)
  const cycleAverage = cycleAverageLitersPerDay(cycle, readings)

  const baseline = computeBaseline(
    days,
    {
      windowDays: state.settings.baselineWindowDays,
      multiplier: state.settings.outlier.multiplier,
      madFactor: state.settings.outlier.madFactor,
    },
    cycleAverage,
  )

  const anomalies = detectAnomalies(days, baseline, {
    billableM3,
    tariffs: state.settings.tariffs,
    settings: state.settings,
  })

  const leaks = detectLeakSignals(intervals, state.settings)
  const flow = computeFlowStats(intervals, {
    billableM3,
    tariffs: state.settings.tariffs,
    settings: state.settings,
  })

  const projection = buildProjection({
    cycle,
    readings,
    days,
    settings: state.settings,
    now,
  })

  const gaps = findGaps(readings, cycle, state.settings, now)
  const yesterday = findDayPoint(days, yesterdayKey(now))
  const yesterdayIndex = yesterday ? days.findIndex((day) => day.day === yesterday.day) : -1
  const previous = yesterdayIndex > 0 ? days[yesterdayIndex - 1] : null

  const yesterdayCost = yesterday
    ? dayCost(yesterday.liters / 1000, billableM3, state.settings.tariffs)
    : null
  const previousCost = previous
    ? dayCost(previous.liters / 1000, billableM3, state.settings.tariffs)
    : null

  const conclusions = buildConclusions({
    yesterday,
    baseline,
    anomalies,
    leakSignals: leaks,
    flow,
    projection,
    closeDue: isCloseDue(cycle, state.settings.cycleDay, now),
    gapDays: gaps.unacknowledged.length,
  })

  const history: CycleHistoryRow[] = [...state.cycles]
    .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))
    .map((item) => {
      const itemReadings = cycleReadings(readings, item)
      const itemLast = itemReadings[itemReadings.length - 1] ?? null
      const finalValue = item.finalReading ?? itemLast?.value ?? item.baseValue
      const exactM3 = Math.max(0, finalValue - item.baseValue)
      const billable =
        item.billedM3 ?? Math.max(0, Math.floor(finalValue) - Math.floor(item.baseValue))
      const bill = calcBill(billable, state.settings.tariffs)
      return {
        cycle: item,
        last: itemLast,
        exactM3,
        billableM3: billable,
        bill,
        difference: item.actualBill ? bill.total - item.actualBill.total : null,
      }
    })

  return {
    readings,
    cycle,
    cycles: state.cycles,
    days,
    cycleDays,
    intervals,
    baseline,
    anomalies,
    leaks,
    flow,
    projection,
    gaps,
    yesterday,
    yesterdayCost,
    previousCost,
    yesterdayIsOutlier: yesterday
      ? isDailyOutlier(yesterday.litersPerDay, baseline, {
          windowDays: state.settings.baselineWindowDays,
          multiplier: state.settings.outlier.multiplier,
          madFactor: state.settings.outlier.madFactor,
        })
      : false,
    conclusions,
    closeDue: isCloseDue(cycle, state.settings.cycleDay, now),
    history,
    billableM3,
    currentBill,
  }
}

export function radarDays(analytics: Analytics, count = 7): DayPoint[] {
  return analytics.days.slice(-count)
}

/** Escenario what-if: cambiar el consumo diario o arreglar la fuga. */
export function whatIf(
  analytics: Analytics,
  state: AppState,
  deltaLitersPerDay: number,
): { bill: Bill; m3: number } {
  if (!analytics.projection) {
    const bill = calcBill(analytics.billableM3, state.settings.tariffs)
    return { bill, m3: analytics.billableM3 }
  }
  const remaining = analytics.projection.remainingDays
  const extraM3 = (deltaLitersPerDay * remaining) / 1000
  const projectedReading = analytics.cycle.baseValue + analytics.projection.currentExactM3 + extraM3
  const billable = Math.max(0, Math.floor(projectedReading) - Math.floor(analytics.cycle.baseValue))
  return { bill: calcBill(billable, state.settings.tariffs), m3: billable }
}

export type { Projection }
