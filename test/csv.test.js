import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, parseReadingsCsv, serializeReadingsCsv } from '../public/assets/domain/csv.js'
import { fixtureReadings } from './fixtures/mediciones.js'
import { buildCycles, currentCycle } from '../public/assets/domain/cycles.js'

describe('CSV', () => {
  it('parses quotes, commas and line breaks', () => {
    const rows = parseCsv('a,b,c\n1,"hello, world","line 1\nline 2"\n2,"said ""hey""",ok\n')
    assert.deepEqual(rows, [
      ['a', 'b', 'c'],
      ['1', 'hello, world', 'line 1\nline 2'],
      ['2', 'said "hey"', 'ok'],
    ])
  })

  it('parses the 66 rows of the sheet without errors', () => {
    const parsed = parseReadingsCsv(serializeReadingsCsv(fixtureReadings()))
    assert.deepEqual(parsed.errors, [])
    assert.equal(parsed.readings.length, 66)
    assert.equal(parsed.readings[0].at, '2026-09-20T07:00:00-06:00')
    assert.equal(parsed.readings[0].value, 73)
    assert.equal(parsed.readings[63].value, 103.077)
    assert.ok(parsed.readings[63].note.includes('6 liters'))
    assert.equal(parsed.readings[64].value, 103.643)
    assert.equal(parsed.readings[64].note, 'extra reading')
    assert.equal(parsed.readings[65].value, 103.91)
    assert.equal(parsed.readings[65].note, 'daily reading')
  })

  it('deduplicates by fecha|medicion', () => {
    const csv = [
      'fecha,medicion,nota',
      '10/23/2026 09:20 AM,103.077,uno',
      '10/23/2026 09:20 AM,103.077,dos',
    ].join('\n')
    const parsed = parseReadingsCsv(csv)
    assert.equal(parsed.readings.length, 1)
    assert.equal(parsed.readings[0].note, 'dos')
    assert.match(parsed.errors[0].message, /duplicate/i)
  })

  it('accepts extra columns from the old CSV', () => {
    const csv = [
      'fecha,medicion,consumo,diff,nota',
      '10/23/2026 09:20 AM,103.077,2.794,0.023,"6 liters, check"',
    ].join('\n')
    const parsed = parseReadingsCsv(csv)
    assert.equal(parsed.readings.length, 1)
    assert.equal(parsed.readings[0].note, '6 liters, check')
  })

  it('exports only fecha,medicion,nota', () => {
    const csv = serializeReadingsCsv(fixtureReadings())
    const [header] = csv.split('\n')
    assert.equal(header, 'fecha,medicion,nota')
    assert.ok(!csv.includes('consumo'))
    assert.ok(!csv.includes('L/h'))
    assert.equal(csv.split('\n').filter(Boolean).length, 67)
    assert.equal(parseReadingsCsv(csv).readings.length, 66)
  })

  it('keeps commas and quotes in the round-trip', () => {
    const csv = serializeReadingsCsv([
      {
        id: 'x',
        at: '2026-10-23T09:20:00-06:00',
        value: 1,
        note: 'said "hey", then left\nsecond line',
      },
    ])
    assert.equal(parseReadingsCsv(csv).readings[0].note, 'said "hey", then left\nsecond line')
  })

  it('October 20 belongs to the new cycle', () => {
    const cycles = buildCycles(fixtureReadings(), new Date('2026-10-24T12:00:00-06:00'))
    assert.equal(currentCycle(cycles)?.id, '2026-10')
    assert.equal(currentCycle(cycles)?.baseValue, 100.156)
  })
})
