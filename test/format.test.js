import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatLiters,
  formatLph,
  formatM3,
  formatMoney,
  parseDecimalInput,
  sanitizeMeasurementInput,
} from '../public/assets/domain/format.js'

describe('number formatting', () => {
  it('shows readings with 3 decimals', () => {
    assert.equal(formatM3(103.1), '103.100')
    assert.equal(formatM3(73), '73.000')
    assert.equal(formatM3(2.921), '2.921')
    assert.equal(formatM3(30, 0), '30')
  })

  it('formats liters, L/h and money', () => {
    assert.equal(formatLiters(1517), '1,517 L')
    assert.equal(formatLph(21.234), '21.2 L/h')
    assert.equal(formatMoney(5819), '₡5,819')
  })

  it('accepts a comma or a dot as the decimal separator', () => {
    assert.equal(parseDecimalInput('103,077'), 103.077)
    assert.equal(parseDecimalInput('103.077'), 103.077)
    assert.equal(parseDecimalInput('1,234.567'), 1234.567)
  })

  it('the reading input only keeps digits and one dot', () => {
    assert.equal(sanitizeMeasurementInput('103.077'), '103.077')
    assert.equal(sanitizeMeasurementInput('103,077'), '103077')
    assert.equal(sanitizeMeasurementInput('abc103.07x7'), '103.077')
    assert.equal(sanitizeMeasurementInput('10.3.077'), '10.3077')
    assert.equal(sanitizeMeasurementInput('1-2 3'), '123')
  })
})
