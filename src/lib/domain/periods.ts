import type {
  Cycle,
  CycleSeries,
  CycleSeriesPoint,
  DayPoint,
  Projection,
  Reading,
  Tariffs,
} from './types'
import { cycleReadings } from './cycles'
import { billableConsumption, calcBill } from './billing'
import {
  addDays,
  dayKey,
  dayKeysBetween,
  hoursBetween,
  parseReadingDate,
  startOfDay,
  toIso,
  todayKey,
} from './dates'
import { roundTo } from './format'

export type DailyCyclePoint = {
  day: string
  /** Día del ciclo, 1-based */
  dayNumber: number
  at: string
  litersPerDay: number | null
  m3PerDay: number | null
  kind: 'actual' | 'projected' | 'empty'
}

export type TrafficBand = 'green' | 'yellow' | 'red'

/** Semáforo por porcentaje del máximo: verde ≤75%, amarillo ≤90%, rojo >90%. */
export function trafficBand(value: number | null, max: number): TrafficBand {
  if (value == null || max <= 0) return 'green'
  const ratio = value / max
  if (ratio <= 0.75) return 'green'
  if (ratio <= 0.9) return 'yellow'
  return 'red'
}

/**
 * Serie completa del ciclo, un punto por día calendario.
 * Los días pasados sin medición quedan vacíos; los días restantes se proyectan
 * con el último promedio del ciclo.
 */
export function buildDailyCycle(
  cycle: Cycle,
  days: DayPoint[],
  projection: Projection | null,
  now: Date = new Date(),
  hasReadingToday = days.some((day) => day.day === todayKey(now)),
): DailyCyclePoint[] {
  const firstDay = dayKey(cycle.startAt)
  const lastDay = dayKey(addDays(parseReadingDate(cycle.endAt), -1))
  const keys = dayKeysBetween(firstDay, lastDay)

  const actualByDay = new Map<string, DayPoint>()
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
        kind: 'actual' as const,
      }
    }

    if (canProject && day >= firstProjectedKey && day > lastActualDay) {
      return {
        day,
        dayNumber: index + 1,
        at: toIso(startOfDay(day)),
        litersPerDay: roundTo(rate, 1),
        m3PerDay: roundTo(rate / 1000, 3),
        kind: 'projected' as const,
      }
    }

    return {
      day,
      dayNumber: index + 1,
      at: toIso(startOfDay(day)),
      litersPerDay: null,
      m3PerDay: null,
      kind: 'empty' as const,
    }
  })
}

/** Serie acumulada de un ciclo, un punto por día con medición. */
export function buildCycleSeries(
  cycle: Cycle,
  readings: Reading[],
  projection: Projection | null = null,
): CycleSeries {
  const endIndex = Math.max(0, hoursBetween(cycle.startAt, cycle.endAt) / 24)
  const points: CycleSeriesPoint[] = [{ index: 0, at: cycle.startAt, m3: 0 }]

  if (cycle.baseValue != null) {
    const byDay = new Map<string, Reading>()
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
  const projected: CycleSeriesPoint[] = []
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

export type BillSeriesPoint = {
  index: number
  at: string
  /** Factura estimada acumulada hasta este punto */
  amount: number
}

export type BillSeries = {
  cycle: Cycle
  points: BillSeriesPoint[]
  projected: BillSeriesPoint[]
  totalAmount: number
  endIndex: number
}

function billAmountForM3(cycle: Cycle, m3: number, tariffs: Tariffs): number {
  if (cycle.baseValue == null) return 0
  const billable = billableConsumption(cycle.baseValue + m3, cycle.baseValue)
  return calcBill(billable, tariffs).displayTotal
}

/** Convierte la serie acumulada de m³ en factura estimada acumulada. */
export function buildBillSeries(
  cycle: Cycle,
  readings: Reading[],
  projection: Projection | null,
  tariffs: Tariffs,
): BillSeries {
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

  const points: BillSeriesPoint[] = m3Series.points.map((point) => ({
    index: point.index,
    at: point.at,
    amount: billAmountForM3(cycle, point.m3, tariffs),
  }))

  const projected: BillSeriesPoint[] = m3Series.projected.map((point) => ({
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

export type BillComparison = {
  previous: BillSeries | null
  current: BillSeries
  maxIndex: number
}

export function buildBillComparison(
  cycles: Cycle[],
  readings: Reading[],
  current: Cycle,
  projection: Projection | null,
  tariffs: Tariffs,
): BillComparison {
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

export type BlockMilestone = {
  /** Número de bloque tarifario que se alcanza: 1 = 15 m³, 2 = 30 m³, 3 = 60 m³. */
  block: number
  thresholdM3: number
  /** Índice en la serie acumulada (0 = corte del ciclo). */
  index: number
  at: string
  /** m³ exactos acumulados en ese punto. */
  m3: number
  /** m³ facturables (floor) acumulados en ese punto. */
  billableM3: number
  /** Factura estimada acumulada en ese punto. */
  amount: number
}

/**
 * Punto donde el ciclo alcanza cada bloque tarifario nuevo.
 * Usa la serie acumulada real, sin proyección, y el facturable con floor.
 * Si un solo punto cruza varios bloques, se marcan todos en ese punto.
 */
export function findBlockMilestones(
  cycle: Cycle,
  readings: Reading[],
  tariffs: Tariffs,
): BlockMilestone[] {
  if (cycle.baseValue == null) return []

  const thresholds = tariffs.blocks
    .map((block) => block.upTo)
    .filter((value): value is number => value != null)
  const series = buildCycleSeries(cycle, readings, null)
  const milestones: BlockMilestone[] = []

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
