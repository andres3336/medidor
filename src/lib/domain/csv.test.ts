import { describe, expect, it } from 'vitest'
import { parseCsv, parseReadingsCsv, serializeReadingsCsv } from './csv'
import { fixtureReadings } from './__fixtures__/mediciones'
import { buildCycles, currentCycle } from './cycles'

describe('CSV', () => {
  it('parsea comillas, comas y saltos de línea', () => {
    const rows = parseCsv('a,b,c\n1,"hola, mundo","linea 1\nlinea 2"\n2,"dijo ""epa""",ok\n')
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', 'hola, mundo', 'linea 1\nlinea 2'],
      ['2', 'dijo "epa"', 'ok'],
    ])
  })

  it('parsea las 66 filas de la hoja sin errores', () => {
    const parsed = parseReadingsCsv(serializeReadingsCsv(fixtureReadings()))
    expect(parsed.errors).toEqual([])
    expect(parsed.readings).toHaveLength(66)
    expect(parsed.readings[0].at).toBe('2026-09-20T07:00:00-06:00')
    expect(parsed.readings[0].value).toBe(73)
    expect(parsed.readings[63].value).toBe(103.077)
    expect(parsed.readings[63].note).toContain('6 litros')
    expect(parsed.readings[64].value).toBe(103.643)
    expect(parsed.readings[64].note).toBe('Medicion extra')
    expect(parsed.readings[65].value).toBe(103.91)
    expect(parsed.readings[65].note).toBe('Medicion diaria')
  })

  it('deduplica por fecha|medicion', () => {
    const csv = [
      'fecha,medicion,nota',
      '10/23/2026 09:20 AM,103.077,uno',
      '10/23/2026 09:20 AM,103.077,dos',
    ].join('\n')
    const parsed = parseReadingsCsv(csv)
    expect(parsed.readings).toHaveLength(1)
    expect(parsed.readings[0].note).toBe('dos')
    expect(parsed.errors[0].message).toContain('duplicadas')
  })

  it('acepta columnas extra del CSV viejo', () => {
    const csv = [
      'fecha,medicion,consumo,diff,nota',
      '10/23/2026 09:20 AM,103.077,2.794,0.023,"6 litros, revisar"',
    ].join('\n')
    const parsed = parseReadingsCsv(csv)
    expect(parsed.readings).toHaveLength(1)
    expect(parsed.readings[0].note).toBe('6 litros, revisar')
  })

  it('exporta solo fecha,medicion,nota', () => {
    const csv = serializeReadingsCsv(fixtureReadings())
    const [header] = csv.split('\n')
    expect(header).toBe('fecha,medicion,nota')
    expect(csv).not.toContain('consumo')
    expect(csv).not.toContain('L/h')
    expect(csv.split('\n').filter(Boolean)).toHaveLength(67)
    expect(parseReadingsCsv(csv).readings).toHaveLength(66)
  })

  it('conserva comas y comillas en el round-trip', () => {
    const csv = serializeReadingsCsv([
      {
        id: 'x',
        at: '2026-10-23T09:20:00-06:00',
        value: 1,
        note: 'dijo "epa", luego se fue\nsegunda línea',
        tags: [],
        flag: false,
        createdAt: '',
        updatedAt: '',
        deleted: false,
      },
    ])
    expect(parseReadingsCsv(csv).readings[0].note).toBe('dijo "epa", luego se fue\nsegunda línea')
  })

  it('el 20 de octubre pertenece al ciclo nuevo', () => {
    const cycles = buildCycles(fixtureReadings(), new Date('2026-10-24T12:00:00-06:00'))
    expect(currentCycle(cycles)?.id).toBe('2026-10')
    expect(currentCycle(cycles)?.baseValue).toBe(100.156)
  })
})
