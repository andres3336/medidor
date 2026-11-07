import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  billableConsumption,
  calcBill,
  dailyApproximateCost,
  exactConsumption,
  isSuspectConsumption,
  metersToThreshold,
} from '../public/assets/domain/billing.js'
import { defaultTariffs, marginalCostPerM3 } from '../public/assets/domain/tariffs.js'
import { formatMoney } from '../public/assets/domain/format.js'
import { closeTo } from './helpers.js'

const tariffs = defaultTariffs()

describe('ARESEP billing', () => {
  const cases = [
    [3, 5819, 0],
    [15, 16295, 0],
    [27, 37559, 0],
    [30, 42875, 0],
    [31, 48089.7, 2975.7],
    [40, 69656.4, 4391.4],
    [44, 79241.6, 5020.6],
    [60, 117582.4, 7537.4],
    [61, 121692.05, 7798.05],
  ]

  for (const [m3, total, iva] of cases) {
    it(`consumption ${m3} m³ → ${total}`, () => {
      const bill = calcBill(m3, tariffs)
      closeTo(bill.total, total, 2)
      closeTo(bill.iva, iva, 2)
    })
  }

  it('truncates billable consumption', () => {
    assert.equal(calcBill(15.999, tariffs).billableM3, 15)
    assert.equal(calcBill(15.999, tariffs).total, 16295)
    assert.equal(calcBill(30.999, tariffs).billableM3, 30)
    assert.equal(calcBill(30.999, tariffs).total, 42875)
  })

  it('charges only the fixed fees with zero consumption', () => {
    const bill = calcBill(0, tariffs)
    assert.equal(bill.total, 3200)
    assert.equal(bill.iva, 0)
    assert.ok(bill.blocks.every((block) => block.units === 0))
  })

  it('computes block 2 from 16 m³', () => {
    assert.equal(calcBill(16, tariffs).total, 18067)
  })

  it('applies marginal IVA from m³ 31', () => {
    const at29 = dailyApproximateCost(1, 29, tariffs)
    const at30 = dailyApproximateCost(1, 30, tariffs)
    assert.ok(at30 > at29)
    assert.equal(marginalCostPerM3(29, tariffs), 1772)
    closeTo(marginalCostPerM3(30, tariffs), 2239 + 1210 * 0.13, 2)
  })

  it('flags suspect consumption when the reading drops below the base', () => {
    assert.equal(isSuspectConsumption(99.9, 100.283), true)
    assert.equal(isSuspectConsumption(103.077, 100.283), false)
  })

  it('applies IVA to the whole aqueduct only above 30 m³', () => {
    assert.equal(calcBill(30, tariffs).crossesIvaThreshold, false)
    assert.equal(calcBill(31, tariffs).crossesIvaThreshold, true)
    assert.equal(calcBill(31, tariffs).components.acueducto, 22890)
    closeTo(calcBill(31, tariffs).iva, 2975.7, 2)
  })

  it('shows the total rounded up to the colón', () => {
    assert.equal(calcBill(31, tariffs).displayTotal, 48090)
    assert.equal(formatMoney(calcBill(31, tariffs).total), '₡48,090')
    assert.equal(formatMoney(5819), '₡5,819')
  })

  it('the 30 → 31 jump is ₡5,214.70', () => {
    const jump = calcBill(31, tariffs).total - calcBill(30, tariffs).total
    closeTo(jump, 5214.7, 2)
  })

  it('floors readings before subtracting', () => {
    closeTo(exactConsumption(103.077, 100.283), 2.794, 3)
    assert.equal(billableConsumption(103.077, 100.283), 3)
    assert.equal(billableConsumption(100.283, 100.283), 0)
    assert.equal(billableConsumption(99.9, 100.283), 0)
  })

  it('does not charge excluded components', () => {
    const bill = calcBill(3, tariffs, {
      include: { alcantarillado: false, hidrantes: false, tprh: false },
    })
    assert.equal(bill.components.alcantarillado, 0)
    assert.equal(bill.total, 3311)
  })

  it('computes remaining thresholds', () => {
    assert.deepEqual(metersToThreshold(27), { fifteen: null, thirty: 3, sixty: 33 })
    assert.deepEqual(metersToThreshold(31), { fifteen: null, thirty: null, sixty: 29 })
  })

  it('marginal cost includes IVA only after 30 m³', () => {
    assert.equal(marginalCostPerM3(10, tariffs), 873)
    closeTo(marginalCostPerM3(31, tariffs), 2239 + 1210 * 0.13, 2)
  })

  it('approximate daily cost does not include the fixed fee', () => {
    closeTo(dailyApproximateCost(0.29, 3, tariffs), 0.29 * 873, 2)
  })
})
