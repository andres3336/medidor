import { describe, expect, it } from 'vitest'
import {
  billableConsumption,
  calcBill,
  dailyApproximateCost,
  exactConsumption,
  isSuspectConsumption,
  metersToThreshold,
} from './billing'
import { defaultTariffs, marginalCostPerM3 } from './tariffs'
import { formatMoney } from './format'

const tariffs = defaultTariffs()

describe('facturación ARESEP', () => {
  const cases: Array<[number, number, number]> = [
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

  it.each(cases)('consumo %i m³ → %d', (m3, total, iva) => {
    const bill = calcBill(m3, tariffs)
    expect(bill.total).toBeCloseTo(total, 2)
    expect(bill.iva).toBeCloseTo(iva, 2)
  })

  it('trunca el consumo facturable', () => {
    expect(calcBill(15.999, tariffs).billableM3).toBe(15)
    expect(calcBill(15.999, tariffs).total).toBe(16295)
    expect(calcBill(30.999, tariffs).billableM3).toBe(30)
    expect(calcBill(30.999, tariffs).total).toBe(42875)
  })

  it('cobra solo cargos fijos con consumo cero', () => {
    const bill = calcBill(0, tariffs)
    expect(bill.total).toBe(3200)
    expect(bill.iva).toBe(0)
    expect(bill.blocks.every((block) => block.units === 0)).toBe(true)
  })

  it('calcula el bloque 2 desde 16 m³', () => {
    expect(calcBill(16, tariffs).total).toBe(18067)
  })

  it('aplica IVA marginal desde el m³ 31', () => {
    const at29 = dailyApproximateCost(1, 29, tariffs)
    const at30 = dailyApproximateCost(1, 30, tariffs)
    expect(at30).toBeGreaterThan(at29)
    expect(marginalCostPerM3(29, tariffs)).toBe(1772)
    expect(marginalCostPerM3(30, tariffs)).toBeCloseTo(2239 + 1210 * 0.13, 2)
  })

  it('marca consumo sospechoso si la lectura baja de la base', () => {
    expect(isSuspectConsumption(99.9, 100.283)).toBe(true)
    expect(isSuspectConsumption(103.077, 100.283)).toBe(false)
  })

  it('aplica IVA a todo el acueducto solo por encima de 30 m³', () => {
    expect(calcBill(30, tariffs).crossesIvaThreshold).toBe(false)
    expect(calcBill(31, tariffs).crossesIvaThreshold).toBe(true)
    expect(calcBill(31, tariffs).components.acueducto).toBe(22890)
    expect(calcBill(31, tariffs).iva).toBeCloseTo(2975.7, 2)
  })

  it('muestra el total redondeado hacia arriba al colón', () => {
    expect(calcBill(31, tariffs).displayTotal).toBe(48090)
    expect(formatMoney(calcBill(31, tariffs).total)).toBe('₡48,090')
    expect(formatMoney(5819)).toBe('₡5,819')
  })

  it('el salto 30 → 31 es de ₡5,214.70', () => {
    const jump = calcBill(31, tariffs).total - calcBill(30, tariffs).total
    expect(jump).toBeCloseTo(5214.7, 2)
  })

  it('redondea lecturas con floor antes de restar', () => {
    expect(exactConsumption(103.077, 100.283)).toBeCloseTo(2.794, 3)
    expect(billableConsumption(103.077, 100.283)).toBe(3)
    expect(billableConsumption(100.283, 100.283)).toBe(0)
    expect(billableConsumption(99.9, 100.283)).toBe(0)
  })

  it('no cobra componentes excluidos', () => {
    const bill = calcBill(3, tariffs, {
      include: { alcantarillado: false, hidrantes: false, tprh: false },
    })
    expect(bill.components.alcantarillado).toBe(0)
    expect(bill.total).toBe(3311)
  })

  it('calcula umbrales restantes', () => {
    expect(metersToThreshold(27)).toEqual({ fifteen: null, thirty: 3, sixty: 33 })
    expect(metersToThreshold(31)).toEqual({ fifteen: null, thirty: null, sixty: 29 })
  })

  it('costo marginal incluye IVA solo después de 30 m³', () => {
    expect(marginalCostPerM3(10, tariffs)).toBe(873)
    expect(marginalCostPerM3(31, tariffs)).toBeCloseTo(2239 + 1210 * 0.13, 2)
  })

  it('costo diario aproximado no incluye cargo fijo', () => {
    expect(dailyApproximateCost(0.29, 3, tariffs)).toBeCloseTo(0.29 * 873, 2)
  })
})
