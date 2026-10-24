import type { FlowStats, Interval, Reading, Settings, Tariffs } from './types'
import { calcBill } from './billing'
import { hourOfDay, minuteOfHour } from './dates'
import { minPositive, quantile } from './stats'

export function positiveFlows(intervals: Interval[]): number[] {
  return intervals.map((interval) => interval.lph).filter((lph) => Number.isFinite(lph) && lph > 0)
}

/** Flujo basal: p10 de los L/h positivos; con pocos datos, el mínimo positivo. */
export function basalFlow(intervals: Interval[]): number {
  const flows = positiveFlows(intervals)
  if (flows.length === 0) return 0
  if (flows.length < 10) return minPositive(flows) ?? 0
  return quantile(flows, 0.1)
}

export function isNocturnal(interval: Interval): boolean {
  const hour = hourOfDay(interval.to.at)
  const minute = minuteOfHour(interval.to.at)
  const decimal = hour + minute / 60
  return decimal >= 22 || decimal < 6
}

export function nocturnalAverage(intervals: Interval[]): number | null {
  const flows = intervals.filter(isNocturnal).map((interval) => interval.lph)
  const valid = flows.filter((lph) => Number.isFinite(lph) && lph >= 0)
  if (valid.length === 0) return null
  return valid.reduce((total, value) => total + value, 0) / valid.length
}

export type FlowContext = {
  billableM3: number
  tariffs: Tariffs
  settings: Settings
}

/**
 * Estadísticas de flujo y costo de fuga.
 * No afirma "fuga confirmada": mide flujo continuo sospechoso.
 */
export function computeFlowStats(intervals: Interval[], context: FlowContext): FlowStats {
  const basal = basalFlow(intervals)
  const monthlyLossM3 = (basal * 24 * 30) / 1000
  const currentBill = calcBill(context.billableM3, context.tariffs)
  const withLeak = calcBill(context.billableM3 + monthlyLossM3, context.tariffs)

  const severity: FlowStats['severity'] =
    basal >= context.settings.flow.dangerLph
      ? 'danger'
      : basal >= context.settings.flow.warningLph
        ? 'warn'
        : 'ok'

  return {
    basalLph: basal,
    minPositiveLph: minPositive(positiveFlows(intervals)) ?? 0,
    nocturnalLph: nocturnalAverage(intervals),
    sampleSize: positiveFlows(intervals).length,
    monthlyLossM3,
    monthlyCost: withLeak.total - currentBill.total,
    severity,
  }
}

/** Costo aproximado de la fuga si sigue igual todo el mes. */
export function leakCostFor(intervals: Interval[], billableM3: number, tariffs: Tariffs): number {
  const basal = basalFlow(intervals)
  const loss = (basal * 24 * 30) / 1000
  return calcBill(billableM3 + loss, tariffs).total - calcBill(billableM3, tariffs).total
}

export function flowSeverity(lph: number, settings: Settings): FlowStats['severity'] {
  if (lph >= settings.flow.dangerLph) return 'danger'
  if (lph >= settings.flow.warningLph) return 'warn'
  return 'ok'
}

/** Intervalos con lectura de la casa pero flujo positivo: señal de fuga. */
export function suspiciousIntervals(intervals: Interval[], settings: Settings): Interval[] {
  return intervals.filter(
    (interval) => Number.isFinite(interval.lph) && interval.lph >= settings.flow.warningLph,
  )
}

export function readingsWithFlow(readings: Reading[]): Reading[] {
  return readings.filter((reading) => !reading.deleted)
}
