/**
 * Fechas del medidor. Costa Rica es UTC-6 todo el año (sin horario de verano),
 * así que el offset es fijo y no hace falta una librería de zonas horarias.
 */

export const CR_TIMEZONE = 'America/Costa_Rica'
export const CR_OFFSET_HOURS = -6
const CR_OFFSET_MS = CR_OFFSET_HOURS * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const CSV_DATE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
const ISO_LIKE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0')
}

function crWallClock(date: Date) {
  const shifted = new Date(date.getTime() + CR_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  }
}

/**
 * Acepta el formato del CSV (`MM/DD/YYYY hh:mm AM/PM`) y también ISO 8601.
 * Un ISO sin offset se interpreta como hora de Costa Rica.
 */
export function parseReadingDate(input: string): Date {
  const value = input.trim()

  const csv = CSV_DATE.exec(value)
  if (csv) {
    const [, month, day, year, hourRaw, minute, second = '0', meridiem] = csv
    let hour = Number(hourRaw)
    if (meridiem) {
      const pm = meridiem.toUpperCase() === 'PM'
      if (pm && hour !== 12) hour += 12
      if (!pm && hour === 12) hour = 0
    }
    const utc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      hour - CR_OFFSET_HOURS,
      Number(minute),
      Number(second),
    )
    const parsed = new Date(utc)
    if (Number.isNaN(parsed.getTime())) throw new Error(`Fecha inválida: ${input}`)
    return parsed
  }

  const iso = ISO_LIKE.exec(value)
  if (iso) {
    const [, year, month, day, hour, minute, second = '0', millis = '0', zone] = iso
    if (zone) return new Date(value)
    const utc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - CR_OFFSET_HOURS,
      Number(minute),
      Number(second),
      Number(millis.padEnd(3, '0')),
    )
    return new Date(utc)
  }

  const fallback = new Date(value)
  if (Number.isNaN(fallback.getTime())) throw new Error(`Fecha inválida: ${input}`)
  return fallback
}

/** ISO 8601 canónico con offset -06:00 (lo que se guarda y se exporta). */
export function toIso(date: Date): string {
  const p = crWallClock(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}-06:00`
}

export function nowIso(): string {
  return toIso(new Date())
}

export function hoursBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === 'string' ? parseReadingDate(from) : from
  const b = typeof to === 'string' ? parseReadingDate(to) : to
  return (b.getTime() - a.getTime()) / HOUR_MS
}

export function daysBetween(from: string | Date, to: string | Date): number {
  return hoursBetween(from, to) / 24
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Clave de día en hora de Costa Rica: `YYYY-MM-DD`. */
export function dayKey(input: string | Date): string {
  const date = typeof input === 'string' ? parseReadingDate(input) : input
  const p = crWallClock(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Medianoche de Costa Rica (06:00 UTC) para un día `YYYY-MM-DD`. */
export function startOfDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, -CR_OFFSET_HOURS, 0, 0))
}

export function endOfDay(day: string): Date {
  return new Date(startOfDay(day).getTime() + DAY_MS - 1)
}

export function todayKey(now: Date = new Date()): string {
  return dayKey(now)
}

export function yesterdayKey(now: Date = new Date()): string {
  return dayKey(addDays(now, -1))
}

export function dayKeysBetween(fromDay: string, toDay: string): string[] {
  const out: string[] = []
  let cursor = startOfDay(fromDay)
  const end = startOfDay(toDay).getTime()
  while (cursor.getTime() <= end) {
    out.push(dayKey(cursor))
    cursor = addDays(cursor, 1)
  }
  return out
}

export function isWeekend(day: string): boolean {
  const weekday = startOfDay(day).getUTCDay()
  return weekday === 0 || weekday === 6
}

const dateFormatter = new Intl.DateTimeFormat('es-CR', {
  timeZone: CR_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const MONTHS_ES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
] as const

const timeFormatter = new Intl.DateTimeFormat('es-CR', {
  timeZone: CR_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Hora con AM/PM, como el CSV original. */
const time12Formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CR_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const weekdayFormatter = new Intl.DateTimeFormat('es-CR', {
  timeZone: CR_TIMEZONE,
  weekday: 'short',
})

function asDate(input: string | Date): Date {
  return typeof input === 'string' ? parseReadingDate(input) : input
}

export function formatDate(input: string | Date): string {
  return dateFormatter.format(asDate(input)).replace(/\.$/, '')
}

/** Fecha corta consistente en toda la app: `23-OCT`. */
export function formatDayMonth(input: string | Date): string {
  const key = dayKey(input)
  const [, month, day] = key.split('-').map(Number)
  return `${String(day).padStart(2, '0')}-${MONTHS_ES[month - 1]}`
}

export function formatTime(input: string | Date): string {
  return timeFormatter.format(asDate(input))
}

export function formatTime12(input: string | Date): string {
  return time12Formatter.format(asDate(input))
}

/** Hora local de Costa Rica (0–23). */
export function hourOfDay(input: string | Date): number {
  const p = crWallClock(asDate(input))
  return p.hour
}

/** Minuto local de Costa Rica (0–59). */
export function minuteOfHour(input: string | Date): number {
  return crWallClock(asDate(input)).minute
}

export function formatDateTime(input: string | Date): string {
  return `${formatDayMonth(input)} ${formatTime(input)}`
}

export function formatWeekday(input: string | Date): string {
  return weekdayFormatter.format(asDate(input)).replace(/\.$/, '')
}

export function relativeDayLabel(day: string, now: Date = new Date()): string {
  if (day === todayKey(now)) return 'hoy'
  if (day === yesterdayKey(now)) return 'ayer'
  const diff = Math.round(daysBetween(startOfDay(day), startOfDay(todayKey(now))))
  if (diff > 1 && diff < 7) return `hace ${diff} días`
  return formatDayMonth(startOfDay(day))
}
