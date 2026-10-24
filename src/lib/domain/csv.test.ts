import { describe, expect, it } from 'vitest'
import { parseCsv, parseReadingsCsv, serializeReadingsCsv } from './csv'
import { SEED_CSV, seedReadings } from './seed'
import { findCycleFor } from './cycles'
import { seedCycles } from './settings'

describe('CSV', () => {
  it('parsea comillas, comas y saltos de línea', () => {
    const rows = parseCsv('a,b,c\n1,"hola, mundo","linea 1\nlinea 2"\n2,"dijo ""epa""",ok\n')
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', 'hola, mundo', 'linea 1\nlinea 2'],
      ['2', 'dijo "epa"', 'ok'],
    ])
  })

  it('carga las 60 filas del data.csv sin errores', () => {
    const parsed = parseReadingsCsv(SEED_CSV)
    expect(parsed.errors).toEqual([])
    expect(parsed.readings).toHaveLength(60)
    expect(parsed.readings[0].at).toBe('2026-09-24T08:41:00-06:00')
    expect(parsed.readings[0].value).toBe(79.656)
    expect(parsed.readings[59].value).toBe(103.077)
    expect(parsed.readings[59].note).toContain('6 litros')
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
    const csv = serializeReadingsCsv(seedReadings())
    const [header] = csv.split('\n')
    expect(header).toBe('fecha,medicion,nota')
    expect(csv).not.toContain('consumo')
    expect(csv).not.toContain('L/h')
    expect(csv.split('\n').filter(Boolean)).toHaveLength(61)
    expect(parseReadingsCsv(csv).readings).toHaveLength(60)
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

  it('asigna la lectura de corte al ciclo nuevo', () => {
    const cycles = seedCycles()
    const boundary = findCycleFor(cycles, '2026-10-20T10:05:00-06:00')
    expect(boundary?.id).toBe('2026-10')
    expect(findCycleFor(cycles, '2026-10-20T09:00:00-06:00')?.id).toBe('2026-09')
  })
})
