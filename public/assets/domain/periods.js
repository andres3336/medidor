import { cycleReadings } from './cycles.js'
import { billableConsumption, calcBill } from './billing.js'
import {
  addDays,
  dayKey,
  dayKeysBetween,
  hoursBetween,
  parseReadingDate,
  startOfDay,
  toIso,
  todayKey,
} from './dates.js'
import { roundTo } from './format.js'

/** Traffic light by percentage of the maximum: green ≤75%, yellow ≤90%, red >90%. */
export function trafficBand(value, max) {
  if (value == null || max <= 0) return 'green'
  const ratio = value / max
  if (ratio <= 0.75) return 'green'
  if (ratio <= 0.9) return 'yellow'
  return 'red'
}

/**
 * Full cycle series, one point per calendar day.
 * Past days without a reading stay empty; remaining days are projected with
 * the latest cycle average.
 */
export function buildDailyCycle(
  cycle,
  days,
  projection,
  now = new Date(),
  hasReadingToday = days.some((day) => day.day === todayKey(now)),
) {
  const firstDay = dayKey(cycle.startAt)
  const lastDay = dayKey(addDays(parseReadingDate(cycle.endAt), -1))
  const keys = dayKeysBetween(firstDay, lastDay)

  const actualByDay = new Map()
  for (const day of days) {
    if (day.day >= firstDay && day.day <= lastDay) actualByDay.set(day.day, day)
  }

  const lastActualDay = [...actualByDay.keys()].sort().at(-1) ?? null
  const today = todayKey(now)
  const firstProjectedKey = hasReadingToday ? dayKey(addDays(startOfDay(today), 1)) : today
  const rate = projection?.rateLitersPerDay ?? null
  const canProject = projection != null && cycle.open && rate != null && lastActualDay != null

  return keys.map((day, index) => {
    const actual = actualByDay.get(day)
    if (actual) {
      return {
        day,
        dayNumber: index + 1,
        at: actual.at,
        litersPerDay: actual.litersPerDay,
        m3PerDay: actual.litersPerDay / 1000,
        kind: 'actual',
      }
    }

    if (canProject && day >= firstProjectedKey && day > lastActualDay) {
      return {
        day,
        dayNumber: index + 1,
        at: toIso(startOfDay(day)),
        litersPerDay: roundTo(rate, 1),
        m3PerDay: roundTo(rate / 1000, 3),
        kind: 'projected',
      }
    }

    return {
      day,
      dayNumber: index + 1,
      at: toIso(startOfDay(day)),
      litersPerDay: null,
      m3PerDay: null,
      kind: 'empty',
    }
  })
}

/**
 * Daily comparison of two cycles.
 *
 * Aligns day N of the current cycle with day N of the previous one and
 * returns every day in the view (32 by default). Days without a reading stay
 * null. It does not project: only real readings are used.
 */
export function buildDailyComparison(current, previous, days, displayDays = 32) {
  const currentDaily = buildDailyCycle(current, days, null)
  const previousDaily = previous ? buildDailyCycle(previous, days, null) : []
  const maxDay = Math.max(displayDays, currentDaily.length, previousDaily.length)
  const previousByDay = new Map(previousDaily.map((point) => [point.dayNumber, point]))
  const currentByDay = new Map(currentDaily.map((point) => [point.dayNumber, point]))

  const points = []
  for (let dayNumber = 1; dayNumber <= maxDay; dayNumber += 1) {
    const previousPoint = previousByDay.get(dayNumber)
    const currentPoint = currentByDay.get(dayNumber)
    const previousM3 =
      previousPoint?.kind === 'actual' && previousPoint.m3PerDay != null
        ? roundTo(previousPoint.m3PerDay, 3)
        : null
    const currentM3 =
      currentPoint?.kind === 'actual' && currentPoint.m3PerDay != null
        ? roundTo(currentPoint.m3PerDay, 3)
        : null
    points.push({
      dayNumber,
      previousM3,
      currentM3,
      previousAt: previousPoint?.at ?? null,
      currentAt: currentPoint?.at ?? null,
      higherThanPrevious: previousM3 == null || currentM3 == null ? null : currentM3 > previousM3,
    })
  }

  return { days: points, maxDay }
}

/** Accumulated series for one cycle, one point per day with a reading. */
export function buildCycleSeries(cycle, readings, projection = null) {
  const endIndex = Math.max(0, hoursBetween(cycle.startAt, cycle.endAt) / 24)
  const points = [{ index: 0, at: cycle.startAt, m3: 0 }]

  if (cycle.baseValue != null) {
    const byDay = new Map()
    for (const reading of cycleReadings(readings, cycle)) {
      if (reading.value < cycle.baseValue) continue
      byDay.set(dayKey(reading.at), reading)
    }

    for (const reading of [...byDay.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      const index = roundTo(Math.max(0, hoursBetween(cycle.startAt, reading.at) / 24), 3)
      points.push({
        index,
        at: reading.at,
        m3: roundTo(reading.value - cycle.baseValue, 3),
      })
    }
  }

  const lastPoint = points[points.length - 1]
  const projected = []
  if (projection && cycle.open && cycle.baseValue != null) {
    const lastIndex = lastPoint.index
    const rateM3PerDay = projection.rateLitersPerDay / 1000
    projected.push(lastPoint)

    for (let index = Math.ceil(lastIndex); index <= Math.floor(endIndex); index += 1) {
      if (index <= lastIndex) continue
      projected.push({
        index,
        at: toIso(addDays(parseReadingDate(cycle.startAt), index)),
        m3: roundTo(lastPoint.m3 + (index - lastIndex) * rateM3PerDay, 3),
      })
    }

    if (endIndex > lastIndex) {
      projected.push({
        index: roundTo(endIndex, 3),
        at: cycle.endAt,
        m3: roundTo(projection.projectedM3, 3),
      })
    }
  }

  return {
    cycle,
    points,
    projected,
    totalM3: roundTo(lastPoint.m3, 3),
    endIndex: roundTo(endIndex, 3),
  }
}

function billAmountForM3(cycle, m3, tariffs) {
  if (cycle.baseValue == null) return 0
  const billable = billableConsumption(cycle.baseValue + m3, cycle.baseValue)
  return calcBill(billable, tariffs).displayTotal
}

/** Converts the accumulated m³ series into an estimated accumulated bill. */
export function buildBillSeries(cycle, readings, projection, tariffs) {
  const m3Series = buildCycleSeries(cycle, readings, projection)
  if (cycle.baseValue == null) {
    return {
      cycle,
      points: [],
      projected: [],
      totalAmount: 0,
      endIndex: m3Series.endIndex,
    }
  }

  const points = m3Series.points.map((point) => ({
    index: point.index,
    at: point.at,
    amount: billAmountForM3(cycle, point.m3, tariffs),
  }))

  const projected = m3Series.projected.map((point) => ({
    index: point.index,
    at: point.at,
    amount: billAmountForM3(cycle, point.m3, tariffs),
  }))

  return {
    cycle,
    points,
    projected,
    totalAmount: points.at(-1)?.amount ?? 0,
    endIndex: m3Series.endIndex,
  }
}

export function buildBillComparison(cycles, readings, current, projection, tariffs) {
  const index = cycles.findIndex((cycle) => cycle.id === current.id)
  const previousCycle = index > 0 ? cycles[index - 1] : null
  const currentSeries = buildBillSeries(current, readings, projection, tariffs)
  const previousSeries = previousCycle
    ? buildBillSeries(previousCycle, readings, null, tariffs)
    : null
  const maxIndex = Math.max(
    currentSeries.endIndex,
    previousSeries?.endIndex ?? 0,
    ...currentSeries.points.map((point) => point.index),
    ...currentSeries.projected.map((point) => point.index),
    ...(previousSeries?.points.map((point) => point.index) ?? []),
  )
  return {
    previous: previousSeries,
    current: currentSeries,
    maxIndex: Math.max(1, roundTo(maxIndex, 3)),
  }
}

/**
 * Point where the cycle reaches each new tariff block.
 * Uses the real accumulated series, without projection, and floor billing.
 * If a single point crosses several blocks, all are marked at that point.
 */
export function findBlockMilestones(cycle, readings, tariffs) {
  if (cycle.baseValue == null) return []

  const thresholds = tariffs.blocks
    .map((block) => block.upTo)
    .filter((value) => value != null)
  const series = buildCycleSeries(cycle, readings, null)
  const milestones = []

  for (const point of series.points) {
    if (point.index <= 0) continue
    const billable = billableConsumption(cycle.baseValue + point.m3, cycle.baseValue)
    for (const [position, threshold] of thresholds.entries()) {
      if (billable < threshold) continue
      if (milestones.some((item) => item.thresholdM3 === threshold)) continue
      milestones.push({
        block: position + 1,
        thresholdM3: threshold,
        index: point.index,
        at: point.at,
        m3: point.m3,
        billableM3: billable,
        amount: calcBill(billable, tariffs).displayTotal,
      })
    }
  }

  return milestones
}
