import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  dayKey,
  dayKeysBetween,
  formatDateTime,
  formatDayMonth,
  formatTime12,
  hoursBetween,
  parseReadingDate,
  startOfDay,
  toIso,
  yesterdayKey,
} from '../public/assets/domain/dates.js'
import { closeTo } from './helpers.js'

describe('Costa Rica dates', () => {
  it('parses the CSV format', () => {
    const date = parseReadingDate('09/24/2026 08:41 AM')
    assert.equal(toIso(date), '2026-09-24T08:41:00-06:00')
    assert.equal(date.toISOString(), '2026-09-24T14:41:00.000Z')
  })

  it('handles AM, PM and noon', () => {
    assert.equal(toIso(parseReadingDate('10/05/2026 12:28 PM')), '2026-10-05T12:28:00-06:00')
    assert.equal(toIso(parseReadingDate('10/05/2026 01:28 PM')), '2026-10-05T13:28:00-06:00')
    assert.equal(toIso(parseReadingDate('10/05/2026 12:15 AM')), '2026-10-05T00:15:00-06:00')
  })

  it('accepts ISO with and without an offset', () => {
    assert.equal(
      toIso(parseReadingDate('2026-10-23T08:15:00-06:00')),
      '2026-10-23T08:15:00-06:00',
    )
    assert.equal(toIso(parseReadingDate('2026-10-23T08:15:00')), '2026-10-23T08:15:00-06:00')
    assert.equal(toIso(parseReadingDate('2026-10-23T14:15:00Z')), '2026-10-23T08:15:00-06:00')
  })

  it('computes local day keys', () => {
    assert.equal(dayKey('2026-10-23T23:59:00-06:00'), '2026-10-23')
    assert.equal(dayKey('2026-10-24T00:01:00-06:00'), '2026-10-24')
    assert.equal(dayKey('2026-10-24T05:59:00Z'), '2026-10-23')
  })

  it('computes hours and days between readings', () => {
    closeTo(hoursBetween('2026-10-23T08:15:00-06:00', '2026-10-23T09:20:00-06:00'), 1.0833, 3)
    closeTo(hoursBetween('2026-10-20T10:05:00-06:00', '2026-10-23T09:20:00-06:00'), 71.25, 2)
  })

  it('builds day ranges', () => {
    assert.deepEqual(dayKeysBetween('2026-10-20', '2026-10-23'), [
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ])
  })

  it('subtracts a day without losing the timezone', () => {
    const day = startOfDay('2026-10-20')
    assert.equal(dayKey(addDays(day, -1)), '2026-10-19')
    assert.ok(formatDateTime('2026-10-20T10:05:00-06:00').includes('10:05'))
    assert.equal(yesterdayKey(new Date('2026-10-24T12:00:00-06:00')), '2026-10-23')
  })

  it('formats time with AM/PM for the table', () => {
    assert.equal(formatTime12('2026-10-23T08:15:00-06:00'), '08:15 AM')
    assert.equal(formatTime12('2026-10-23T21:50:00-06:00'), '09:50 PM')
  })

  it('uses an uppercase DD-MMM date across the app', () => {
    assert.equal(formatDayMonth('2026-09-24T08:41:00-06:00'), '24-SEP')
    assert.equal(formatDayMonth('2026-10-20T10:05:00-06:00'), '20-OCT')
    assert.equal(formatDayMonth('2026-11-20T00:00:00-06:00'), '20-NOV')
    assert.equal(formatDateTime('2026-10-23T09:20:00-06:00'), '23-OCT 09:20')
  })
})
