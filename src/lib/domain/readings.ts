import type { DayPoint, Interval, Reading } from './types'
import { dayKey, hoursBetween, nowIso } from './dates'
import { roundTo, truncate3 } from './format'

export function readingKey(at: string, value: number): string {
  return `${at}|${value.toFixed(3)}`
}

export function makeReading(input: {
  at: string
  value: number
  note?: string
  tags?: string[]
  flag?: boolean
  source?: Reading['source']
  now?: string
}): Reading {
  const now = input.now ?? nowIso()
  return {
    id: `r-${Date.parse(input.at)}-${truncate3(input.value).toFixed(3)}`,
    at: input.at,
    value: truncate3(input.value),
    note: input.note?.trim() ?? '',
    tags: [...new Set(input.tags ?? [])],
    flag: input.flag ?? false,
    source: input.source ?? 'app',
    createdAt: now,
    updatedAt: now,
    deleted: false,
  }
}

export function sortReadings(readings: Reading[]): Reading[] {
  return [...readings].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export function activeReadings(readings: Reading[]): Reading[] {
  return sortReadings(readings.filter((reading) => !reading.deleted))
}

/** Deduplica por `fecha|medicion`, que es la clave de merge del proyecto. */
export function dedupeReadings(readings: Reading[]): Reading[] {
  const seen = new Map<string, Reading>()
  for (const reading of sortReadings(readings)) {
    const key = readingKey(reading.at, reading.value)
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, reading)
      continue
    }
    const winner =
      Date.parse(reading.updatedAt) >= Date.parse(existing.updatedAt) ? reading : existing
    seen.set(key, {
      ...winner,
      flag: existing.flag || reading.flag,
      tags: [...new Set([...existing.tags, ...reading.tags])],
      deleted: winner.deleted,
    })
  }
  return [...seen.values()]
}

export type SheetMergeResult = {
  readings: Reading[]
  added: number
  updated: number
  localOnly: number
}

/**
 * Merge de la hoja publicada con la copia local.
 * La hoja manda en fecha/medición/nota; flags y tags locales se conservan.
 * Las filas locales que no están en la hoja no se borran: se cuentan aparte.
 */
export function mergeSheetReadings(local: Reading[], remote: Reading[]): SheetMergeResult {
  const localByKey = new Map(
    local.map((reading) => [readingKey(reading.at, reading.value), reading]),
  )
  const remoteKeys = new Set(remote.map((reading) => readingKey(reading.at, reading.value)))
  const merged = [...local]
  let added = 0
  let updated = 0

  for (const remoteReading of remote) {
    const key = readingKey(remoteReading.at, remoteReading.value)
    const current = localByKey.get(key)
    if (!current) {
      merged.push(remoteReading)
      localByKey.set(key, remoteReading)
      added += 1
      continue
    }
    if (current.deleted || current.note === remoteReading.note) continue
    const index = merged.findIndex((reading) => reading.id === current.id)
    if (index >= 0) {
      merged[index] = { ...current, note: remoteReading.note, updatedAt: nowIso() }
      updated += 1
    }
  }

  const localOnly = local.filter(
    (reading) => !reading.deleted && !remoteKeys.has(readingKey(reading.at, reading.value)),
  ).length

  return { readings: sortReadings(merged), added, updated, localOnly }
}

/** Intervalos consecutivos entre lecturas activas. */
export function buildIntervals(readings: Reading[]): Interval[] {
  const active = activeReadings(readings)
  const intervals: Interval[] = []
  for (let index = 1; index < active.length; index += 1) {
    const from = active[index - 1]
    const to = active[index]
    const deltaM3 = to.value - from.value
    const hours = hoursBetween(from.at, to.at)
    intervals.push({
      from,
      to,
      deltaM3,
      liters: deltaM3 * 1000,
      hours,
      lph: hours > 0 ? (deltaM3 * 1000) / hours : Number.NaN,
    })
  }
  return intervals
}

export function lastReading(readings: Reading[]): Reading | null {
  const active = activeReadings(readings)
  return active.length === 0 ? null : active[active.length - 1]
}

export function firstReading(readings: Reading[]): Reading | null {
  const active = activeReadings(readings)
  return active.length === 0 ? null : active[0]
}

/**
 * Serie diaria normalizada: última lectura de cada día contra la última del día
 * anterior CON datos. Los huecos no generan picos falsos: se dividen por las
 * horas reales del intervalo.
 */
export function buildDailySeries(readings: Reading[]): DayPoint[] {
  const active = activeReadings(readings)
  const byDay = new Map<string, Reading>()
  for (const reading of active) byDay.set(dayKey(reading.at), reading)

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
  const points: DayPoint[] = []

  for (let index = 1; index < days.length; index += 1) {
    const [day, current] = days[index]
    const [, previous] = days[index - 1]
    const hours = hoursBetween(previous.at, current.at)
    if (hours <= 0) continue
    const liters = (current.value - previous.value) * 1000
    const gapDays = Math.max(0, Math.round(hours / 24) - 1)
    points.push({
      day,
      at: current.at,
      reading: current.value,
      liters,
      hours,
      litersPerDay: liters / (hours / 24),
      gapDays,
      note: current.note,
    })
  }

  return points.map((point) => ({ ...point, litersPerDay: roundTo(point.litersPerDay, 1) }))
}

export function findDayPoint(points: DayPoint[], day: string): DayPoint | null {
  return points.find((point) => point.day === day) ?? null
}

/** Último intervalo completo, para cuando no hay lectura de ayer. */
export function lastInterval(intervals: Interval[]): Interval | null {
  return intervals.length === 0 ? null : intervals[intervals.length - 1]
}

export function readingsInRange(
  readings: Reading[],
  fromIso: string,
  toIsoValue: string,
): Reading[] {
  const from = Date.parse(fromIso)
  const to = Date.parse(toIsoValue)
  return activeReadings(readings).filter((reading) => {
    const time = Date.parse(reading.at)
    return time >= from && time <= to
  })
}
