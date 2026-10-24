import type { Reading } from './types'
import { parseReadingDate, toIso } from './dates'
import { parseDecimalInput, truncate3 } from './format'
import { dedupeReadings, makeReading, sortReadings } from './readings'

export type CsvError = { line: number; message: string }

export type CsvParseResult = {
  readings: Reading[]
  errors: CsvError[]
  rows: number
}

/** Parser RFC 4180: comillas, comas y saltos de línea dentro de la nota. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const clean = text.replace(/^\uFEFF/, '')

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index]

    if (inQuotes) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char === '\r') {
      // se ignora; el \n cierra la fila
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((items) => items.some((item) => item.trim() !== ''))
}

const HEADER_ALIASES = {
  fecha: ['fecha', 'date', 'at'],
  medicion: ['medicion', 'medición', 'lectura', 'value', 'reading'],
  nota: ['nota', 'note', 'comentario'],
} as const

function findColumn(header: string[], aliases: readonly string[]): number {
  return header.findIndex((cell) => aliases.includes(cell.trim().toLowerCase()))
}

function looksLikeHeader(row: string[]): boolean {
  const lower = row.map((cell) => cell.trim().toLowerCase())
  return lower.includes('fecha') || lower.includes('date')
}

/** Acepta el CSV canónico y también versiones viejas con columnas extra. */
export function parseReadingsCsv(text: string): CsvParseResult {
  const rows = parseCsv(text)
  const errors: CsvError[] = []
  if (rows.length === 0)
    return { readings: [], errors: [{ line: 1, message: 'CSV vacío' }], rows: 0 }

  const header = looksLikeHeader(rows[0]) ? rows[0] : null
  const dataRows = header ? rows.slice(1) : rows

  const columns = header
    ? {
        fecha: findColumn(header, HEADER_ALIASES.fecha),
        medicion: findColumn(header, HEADER_ALIASES.medicion),
        nota: findColumn(header, HEADER_ALIASES.nota),
      }
    : { fecha: 0, medicion: 1, nota: 2 }

  if (columns.fecha < 0 || columns.medicion < 0) {
    return {
      readings: [],
      errors: [{ line: 1, message: 'Faltan las columnas fecha o medicion' }],
      rows: 0,
    }
  }

  const readings: Reading[] = []

  dataRows.forEach((row, index) => {
    const line = index + (header ? 2 : 1)
    const fecha = row[columns.fecha]?.trim()
    const medicion = row[columns.medicion]?.trim()
    if (!fecha && !medicion) return
    if (!fecha || !medicion) {
      errors.push({ line, message: 'Fila incompleta: se requiere fecha y medicion' })
      return
    }

    try {
      const at = toIso(parseReadingDate(fecha))
      const value = parseDecimalInput(medicion)
      if (value == null) {
        errors.push({ line, message: `Medición inválida: ${medicion}` })
        return
      }
      readings.push(
        makeReading({
          at,
          value: truncate3(value),
          note: columns.nota >= 0 ? (row[columns.nota] ?? '').trim() : '',
          source: 'data.csv',
        }),
      )
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : 'Fila inválida' })
    }
  })

  const unique = dedupeReadings(readings)
  if (unique.length !== readings.length) {
    errors.push({
      line: 1,
      message: `Se ignoraron ${readings.length - unique.length} lecturas duplicadas (fecha|medicion)`,
    })
  }

  return { readings: sortReadings(unique), errors, rows: dataRows.length }
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * CSV canónico y atómico: solo fecha, medicion y nota.
 * Consumo, L, L/h y costos NO se guardan: son derivados.
 */
export function serializeReadingsCsv(readings: Reading[]): string {
  const lines = ['fecha,medicion,nota']
  for (const reading of sortReadings(readings.filter((item) => !item.deleted))) {
    lines.push(
      `${toIso(parseReadingDate(reading.at))},${reading.value.toFixed(3)},${escapeCsv(reading.note)}`,
    )
  }
  return `${lines.join('\n')}\n`
}
