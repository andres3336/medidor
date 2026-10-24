import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayKey,
  dayKeysBetween,
  formatDateTime,
  hoursBetween,
  parseReadingDate,
  startOfDay,
  toIso,
  yesterdayKey,
} from './dates'

describe('fechas de Costa Rica', () => {
  it('parsea el formato del CSV', () => {
    const date = parseReadingDate('09/24/2026 08:41 AM')
    expect(toIso(date)).toBe('2026-09-24T08:41:00-06:00')
    expect(date.toISOString()).toBe('2026-09-24T14:41:00.000Z')
  })

  it('maneja AM, PM y el mediodía', () => {
    expect(toIso(parseReadingDate('10/05/2026 12:28 PM'))).toBe('2026-10-05T12:28:00-06:00')
    expect(toIso(parseReadingDate('10/05/2026 01:28 PM'))).toBe('2026-10-05T13:28:00-06:00')
    expect(toIso(parseReadingDate('10/05/2026 12:15 AM'))).toBe('2026-10-05T00:15:00-06:00')
  })

  it('acepta ISO con y sin offset', () => {
    expect(toIso(parseReadingDate('2026-10-23T08:15:00-06:00'))).toBe('2026-10-23T08:15:00-06:00')
    expect(toIso(parseReadingDate('2026-10-23T08:15:00'))).toBe('2026-10-23T08:15:00-06:00')
    expect(toIso(parseReadingDate('2026-10-23T14:15:00Z'))).toBe('2026-10-23T08:15:00-06:00')
  })

  it('calcula claves de día locales', () => {
    expect(dayKey('2026-10-23T23:59:00-06:00')).toBe('2026-10-23')
    expect(dayKey('2026-10-24T00:01:00-06:00')).toBe('2026-10-24')
    expect(dayKey('2026-10-24T05:59:00Z')).toBe('2026-10-23')
  })

  it('calcula horas y días entre lecturas', () => {
    expect(hoursBetween('2026-10-23T08:15:00-06:00', '2026-10-23T09:20:00-06:00')).toBeCloseTo(
      1.0833,
      3,
    )
    expect(hoursBetween('2026-10-20T10:05:00-06:00', '2026-10-23T09:20:00-06:00')).toBeCloseTo(
      71.25,
      2,
    )
  })

  it('construye rangos de días', () => {
    expect(dayKeysBetween('2026-10-20', '2026-10-23')).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ])
  })

  it('resta un día sin perder la zona horaria', () => {
    const day = startOfDay('2026-10-20')
    expect(dayKey(addDays(day, -1))).toBe('2026-10-19')
    expect(formatDateTime('2026-10-20T10:05:00-06:00')).toContain('10:05')
    expect(yesterdayKey(new Date('2026-10-24T12:00:00-06:00'))).toBe('2026-10-23')
  })
})
