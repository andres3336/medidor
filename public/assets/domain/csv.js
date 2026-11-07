import { parseReadingDate, toIso } from './dates.js'
import { parseDecimalInput, truncate3 } from './format.js'
import { dedupeReadings, makeReading, sortReadings } from './readings.js'

/** RFC 4180 parser: quotes, commas and line breaks inside the note. */
export function parseCsv(text) {
  const rows = []
  let row = []
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
      // ignored; \n closes the row
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
}

function findColumn(header, aliases) {
  return header.findIndex((cell) => aliases.includes(cell.trim().toLowerCase()))
}

function looksLikeHeader(row) {
  const lower = row.map((cell) => cell.trim().toLowerCase())
  return lower.includes('fecha') || lower.includes('date')
}

/** Accepts the canonical CSV and older versions with extra columns too. */
export function parseReadingsCsv(text) {
  const rows = parseCsv(text)
  const errors = []
  if (rows.length === 0) return { readings: [], errors: [{ line: 1, message: 'Empty CSV' }], rows: 0 }

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
      errors: [{ line: 1, message: 'Missing the fecha or medicion columns' }],
      rows: 0,
    }
  }

  const readings = []

  dataRows.forEach((row, index) => {
    const line = index + (header ? 2 : 1)
    const fecha = row[columns.fecha]?.trim()
    const medicion = row[columns.medicion]?.trim()
    if (!fecha && !medicion) return
    if (!fecha || !medicion) {
      errors.push({ line, message: 'Incomplete row: fecha and medicion are required' })
      return
    }

    try {
      const at = toIso(parseReadingDate(fecha))
      const value = parseDecimalInput(medicion)
      if (value == null) {
        errors.push({ line, message: `Invalid reading: ${medicion}` })
        return
      }
      readings.push(
        makeReading({
          at,
          value: truncate3(value),
          note: columns.nota >= 0 ? (row[columns.nota] ?? '').trim() : '',
        }),
      )
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : 'Invalid row' })
    }
  })

  const unique = dedupeReadings(readings)
  if (unique.length !== readings.length) {
    errors.push({
      line: 1,
      message: `Ignored ${readings.length - unique.length} duplicate readings (fecha|medicion)`,
    })
  }

  return { readings: sortReadings(unique), errors, rows: dataRows.length }
}

function escapeCsv(value) {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Canonical, atomic CSV: only fecha, medicion and nota.
 * Consumption, liters, L/h and costs are NOT stored: they are derived.
 */
export function serializeReadingsCsv(readings) {
  const lines = ['fecha,medicion,nota']
  for (const reading of sortReadings(readings)) {
    lines.push(
      `${toIso(parseReadingDate(reading.at))},${reading.value.toFixed(3)},${escapeCsv(reading.note)}`,
    )
  }
  return `${lines.join('\n')}\n`
}
