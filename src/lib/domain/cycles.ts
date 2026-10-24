import type { Cycle, CycleAdjustment, Reading } from './types'
import {
  dayKey,
  formatDayMonth,
  hoursBetween,
  nowIso,
  parseReadingDate,
  startOfDay,
  todayKey,
} from './dates'
import { billableConsumption } from './billing'
import { activeReadings } from './readings'

export function cycleIdFor(iso: string): string {
  return dayKey(iso).slice(0, 7)
}

export function findCycleFor(cycles: Cycle[], at: string): Cycle | null {
  const time = Date.parse(at)
  return (
    cycles.find((cycle) => {
      const start = Date.parse(cycle.startAt)
      const end = cycle.endAt ? Date.parse(cycle.endAt) : Number.POSITIVE_INFINITY
      return time >= start && time < end
    }) ?? null
  )
}

export function currentCycle(cycles: Cycle[]): Cycle | null {
  const open = cycles.filter((cycle) => cycle.endAt === null)
  if (open.length > 0) return open.sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))[0]
  const sorted = [...cycles].sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))
  return sorted[0] ?? null
}

export function sortedCycles(cycles: Cycle[]): Cycle[] {
  return [...cycles].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
}

export function cycleReadings(readings: Reading[], cycle: Cycle): Reading[] {
  const start = Date.parse(cycle.startAt)
  const end = cycle.endAt ? Date.parse(cycle.endAt) : Number.POSITIVE_INFINITY
  return activeReadings(readings).filter((reading) => {
    const time = Date.parse(reading.at)
    return time >= start && time < end
  })
}

export function lastReadingInCycle(readings: Reading[], cycle: Cycle): Reading | null {
  const inCycle = cycleReadings(readings, cycle)
  return inCycle.length === 0 ? null : inCycle[inCycle.length - 1]
}

/** Fecha de cierre esperada: el día de corte del mes siguiente, en hora CR. */
export function expectedCycleEnd(cycle: Cycle, cycleDay: number): string {
  const [year, month] = dayKey(cycle.startAt).split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  const nextYear = next.getUTCFullYear()
  const nextMonth = next.getUTCMonth() + 1
  const day = Math.min(28, Math.max(1, Math.trunc(cycleDay)))
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-06:00`
}

export function cycleLabel(startAt: string, endAt: string): string {
  return `${formatDayMonth(startAt)} – ${formatDayMonth(endAt)}`
}

export function proposedCloseDate(cycle: Cycle, cycleDay: number): string {
  return expectedCycleEnd(cycle, cycleDay)
}

/** ¿Ya toca cerrar? Desde el día de corte inclusive. */
export function isCloseDue(cycle: Cycle, cycleDay: number, now: Date = new Date()): boolean {
  if (cycle.endAt !== null) return false
  const dueDay = dayKey(expectedCycleEnd(cycle, cycleDay))
  return todayKey(now) >= dueDay
}

export function overdueDays(cycle: Cycle, cycleDay: number, now: Date = new Date()): number {
  const due = startOfDay(dayKey(expectedCycleEnd(cycle, cycleDay)))
  const diff = (now.getTime() - due.getTime()) / 86_400_000
  return Math.max(0, Math.floor(diff))
}

function adjustment(
  field: CycleAdjustment['field'],
  oldValue: number | string,
  newValue: number | string,
  reason: string,
  at: string,
): CycleAdjustment {
  return { at, field, oldValue, newValue, reason }
}

export type CloseCycleInput = {
  cycleId: string
  /** fecha/hora de corte efectiva (la que usa AYA o la que decide el usuario) */
  cutAt: string
  finalReading: number
  /** m³ que facturó AYA; si falta, se calcula con floor(lectura) - floor(base) */
  billedM3?: number
  actualBill?: Cycle['actualBill']
  note?: string
  /** última lectura conocida, para auditar el ajuste de la lectura final */
  lastReading?: number | null
  /** timestamp de la última lectura, para validar la fecha de corte */
  lastReadingAt?: string | null
  /** cierre propuesto por la app, para auditar el cambio de fecha */
  proposedCutAt?: string | null
  /** día de corte configurado (default 20) */
  cycleDay?: number
  now?: string
}

export type CloseCycleResult = {
  cycles: Cycle[]
  closed: Cycle
  next: Cycle
}

/**
 * Cierre manual y auditable. No auto-cierra ni inventa bases: cada campo que el
 * usuario cambia queda registrado en `adjustments`.
 */
export function closeCycle(cycles: Cycle[], input: CloseCycleInput): CloseCycleResult {
  const cycle = cycles.find((item) => item.id === input.cycleId)
  if (!cycle) throw new Error(`Ciclo no encontrado: ${input.cycleId}`)
  if (cycle.endAt !== null) throw new Error(`El ciclo ${input.cycleId} ya está cerrado`)

  const now = input.now ?? nowIso()

  if (!Number.isFinite(input.finalReading) || input.finalReading < cycle.baseValue) {
    throw new Error('La lectura final no puede ser menor que la base del ciclo')
  }
  if (
    !Number.isFinite(Date.parse(input.cutAt)) ||
    Date.parse(input.cutAt) <= Date.parse(cycle.startAt)
  ) {
    throw new Error('La fecha de corte debe ser posterior al inicio del ciclo')
  }
  if (input.lastReadingAt && Date.parse(input.cutAt) < Date.parse(input.lastReadingAt)) {
    throw new Error('La fecha de corte no puede ser anterior a la última lectura del ciclo')
  }
  if (input.billedM3 != null && (!Number.isInteger(input.billedM3) || input.billedM3 < 0)) {
    throw new Error('El consumo facturado debe ser un entero de m³ mayor o igual a 0')
  }

  const computedBilled = billableConsumption(input.finalReading, cycle.baseValue)
  const billedM3 = input.billedM3 ?? computedBilled
  const adjustments: CycleAdjustment[] = []

  if (input.lastReading != null && input.lastReading !== input.finalReading) {
    adjustments.push(
      adjustment(
        'finalReading',
        input.lastReading,
        input.finalReading,
        input.note?.trim() || 'Lectura final ajustada al cerrar el ciclo',
        now,
      ),
    )
  }
  if (billedM3 !== computedBilled) {
    adjustments.push(
      adjustment(
        'billedM3',
        computedBilled,
        billedM3,
        input.note?.trim() || 'Consumo facturado ajustado al cierre',
        now,
      ),
    )
  }
  if (input.proposedCutAt && Date.parse(input.proposedCutAt) !== Date.parse(input.cutAt)) {
    adjustments.push(
      adjustment(
        'startAt',
        input.proposedCutAt,
        input.cutAt,
        input.note?.trim() || 'Fecha de corte ajustada',
        now,
      ),
    )
  }
  if (input.actualBill) {
    adjustments.push(
      adjustment(
        'actualBill',
        '',
        input.actualBill.total,
        input.note?.trim() || 'Monto real registrado',
        now,
      ),
    )
  }

  const closed: Cycle = {
    ...cycle,
    endAt: input.cutAt,
    closedAt: now,
    finalReading: input.finalReading,
    billedM3,
    actualBill: input.actualBill,
    adjustments: [...cycle.adjustments, ...adjustments],
  }

  const baseId = cycleIdFor(input.cutAt)
  const nextStart = input.cutAt
  const expectedEnd = expectedCycleEnd({ ...cycle, startAt: nextStart }, input.cycleDay ?? 20)
  const usedIds = new Set(cycles.map((item) => item.id))
  let nextId = baseId
  if (usedIds.has(nextId)) nextId = `${baseId}-${dayKey(nextStart)}`
  let suffix = 2
  while (usedIds.has(nextId)) {
    nextId = `${baseId}-${dayKey(nextStart)}-${suffix}`
    suffix += 1
  }
  const next: Cycle = {
    id: nextId,
    label: cycleLabel(nextStart, expectedEnd),
    startAt: nextStart,
    endAt: null,
    baseValue: input.finalReading,
    closedAt: null,
    adjustments: [],
  }

  return {
    cycles: [...cycles.filter((item) => item.id !== cycle.id), closed, next],
    closed,
    next,
  }
}

/** Ajuste manual de la base o de la fecha de inicio del ciclo actual. */
export function adjustCycle(
  cycle: Cycle,
  changes: { baseValue?: number; startAt?: string; reason: string },
  now: string = nowIso(),
): Cycle {
  const adjustments = [...cycle.adjustments]
  if (changes.baseValue != null && changes.baseValue !== cycle.baseValue) {
    adjustments.push(
      adjustment('baseValue', cycle.baseValue, changes.baseValue, changes.reason, now),
    )
  }
  if (changes.startAt && changes.startAt !== cycle.startAt) {
    adjustments.push(adjustment('startAt', cycle.startAt, changes.startAt, changes.reason, now))
  }
  return {
    ...cycle,
    baseValue: changes.baseValue ?? cycle.baseValue,
    startAt: changes.startAt ?? cycle.startAt,
    adjustments,
  }
}

/** Días calendario del ciclo transcurridos y restantes. */
export function cycleDayProgress(cycle: Cycle, cycleDay: number, now: Date = new Date()) {
  const start = parseReadingDate(cycle.startAt)
  const end = cycle.endAt
    ? parseReadingDate(cycle.endAt)
    : parseReadingDate(expectedCycleEnd(cycle, cycleDay))
  const elapsed = Math.max(0, hoursBetween(start, now) / 24)
  const total = Math.max(1, hoursBetween(start, end) / 24)
  return {
    elapsedDays: Math.min(elapsed, total),
    remainingDays: Math.max(0, total - elapsed),
    totalDays: total,
    overdueDays: Math.max(0, Math.floor(elapsed - total)),
  }
}
