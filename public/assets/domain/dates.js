/**
 * Meter dates. Costa Rica is UTC-6 all year round (no daylight saving),
 * so the offset is fixed and no timezone library is needed.
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

function pad(value, size = 2) {
  return String(value).padStart(size, '0')
}

function crWallClock(date) {
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
 * Accepts the CSV format (`MM/DD/YYYY hh:mm AM/PM`) and ISO 8601 too.
 * An ISO value without an offset is interpreted as Costa Rica time.
 */
export function parseReadingDate(input) {
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
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${input}`)
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
  if (Number.isNaN(fallback.getTime())) throw new Error(`Invalid date: ${input}`)
  return fallback
}

/** Canonical ISO 8601 with a -06:00 offset (what gets stored and exported). */
export function toIso(date) {
  const p = crWallClock(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}-06:00`
}

export function nowIso() {
  return toIso(new Date())
}

export function hoursBetween(from, to) {
  const a = typeof from === 'string' ? parseReadingDate(from) : from
  const b = typeof to === 'string' ? parseReadingDate(to) : to
  return (b.getTime() - a.getTime()) / HOUR_MS
}

export function daysBetween(from, to) {
  return hoursBetween(from, to) / 24
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Day key in Costa Rica time: `YYYY-MM-DD`. */
export function dayKey(input) {
  const date = typeof input === 'string' ? parseReadingDate(input) : input
  const p = crWallClock(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Costa Rica midnight (06:00 UTC) for a `YYYY-MM-DD` day. */
export function startOfDay(day) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, -CR_OFFSET_HOURS, 0, 0))
}

export function endOfDay(day) {
  return new Date(startOfDay(day).getTime() + DAY_MS - 1)
}

export function todayKey(now = new Date()) {
  return dayKey(now)
}

export function yesterdayKey(now = new Date()) {
  return dayKey(addDays(now, -1))
}

export function dayKeysBetween(fromDay, toDay) {
  const out = []
  let cursor = startOfDay(fromDay)
  const end = startOfDay(toDay).getTime()
  while (cursor.getTime() <= end) {
    out.push(dayKey(cursor))
    cursor = addDays(cursor, 1)
  }
  return out
}

export function isWeekend(day) {
  const weekday = startOfDay(day).getUTCDay()
  return weekday === 0 || weekday === 6
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CR_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CR_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Time with AM/PM, like the original CSV. */
const time12Formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CR_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CR_TIMEZONE,
  weekday: 'short',
})

function asDate(input) {
  return typeof input === 'string' ? parseReadingDate(input) : input
}

export function formatDate(input) {
  return dateFormatter.format(asDate(input)).replace(/\.$/, '')
}

/** Short date used across the app: `24-SEP`. */
export function formatDayMonth(input) {
  const key = dayKey(input)
  const [, month, day] = key.split('-').map(Number)
  return `${String(day).padStart(2, '0')}-${MONTHS_EN[month - 1]}`
}

export function formatTime(input) {
  return timeFormatter.format(asDate(input))
}

export function formatTime12(input) {
  return time12Formatter.format(asDate(input))
}

/** Costa Rica local hour (0–23). */
export function hourOfDay(input) {
  const p = crWallClock(asDate(input))
  return p.hour
}

/** Costa Rica local minute (0–59). */
export function minuteOfHour(input) {
  return crWallClock(asDate(input)).minute
}

export function formatDateTime(input) {
  return `${formatDayMonth(input)} ${formatTime(input)}`
}

export function formatWeekday(input) {
  return weekdayFormatter.format(asDate(input)).replace(/\.$/, '')
}

export function relativeDayLabel(day, now = new Date()) {
  if (day === todayKey(now)) return 'today'
  if (day === yesterdayKey(now)) return 'yesterday'
  const diff = Math.round(daysBetween(startOfDay(day), startOfDay(todayKey(now))))
  if (diff > 1 && diff < 7) return `${diff} days ago`
  return formatDayMonth(startOfDay(day))
}
