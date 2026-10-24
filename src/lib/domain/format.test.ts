import { describe, expect, it } from 'vitest'
import {
  formatLiters,
  formatLph,
  formatM3,
  formatMoney,
  parseDecimalInput,
  sanitizeMeasurementInput,
} from './format'

describe('formato de números', () => {
  it('muestra la medición con 3 decimales', () => {
    expect(formatM3(103.1)).toBe('103.100')
    expect(formatM3(73)).toBe('73.000')
    expect(formatM3(2.921)).toBe('2.921')
    expect(formatM3(30, 0)).toBe('30')
  })

  it('formatea litros, L/h y dinero', () => {
    expect(formatLiters(1517)).toBe('1,517 L')
    expect(formatLph(21.234)).toBe('21.2 L/h')
    expect(formatMoney(5819)).toBe('₡5,819')
  })

  it('acepta coma o punto decimal', () => {
    expect(parseDecimalInput('103,077')).toBe(103.077)
    expect(parseDecimalInput('103.077')).toBe(103.077)
    expect(parseDecimalInput('1,234.567')).toBe(1234.567)
  })

  it('la entrada de medición solo deja dígitos y un punto', () => {
    expect(sanitizeMeasurementInput('103.077')).toBe('103.077')
    expect(sanitizeMeasurementInput('103,077')).toBe('103077')
    expect(sanitizeMeasurementInput('abc103.07x7')).toBe('103.077')
    expect(sanitizeMeasurementInput('10.3.077')).toBe('10.3077')
    expect(sanitizeMeasurementInput('1-2 3')).toBe('123')
  })
})
