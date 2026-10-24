import type { Bill, BillBlockLine, TariffComponent, Tariffs } from './types'
import { blockIndexForM3 } from './tariffs'

export function exactConsumption(currentReading: number, baseReading: number): number {
  return currentReading - baseReading
}

/** Lo que AYA factura: trunca cada lectura a m³ enteros y resta. */
export function billableConsumption(currentReading: number, baseReading: number): number {
  return Math.max(0, Math.floor(currentReading + 1e-9) - Math.floor(baseReading + 1e-9))
}

export type BillOptions = {
  /** permite estimar escenarios sin tocar los toggles globales */
  include?: Tariffs['include']
}

/**
 * Factura estimada.
 * Regla clave: si el consumo facturable supera el umbral, el IVA se aplica a
 * TODO el acueducto (bloques + cargo fijo), no solo al bloque marginal.
 */
export function calcBill(billableM3: number, tariffs: Tariffs, options: BillOptions = {}): Bill {
  const include = options.include ?? tariffs.include
  const consumption = Math.max(0, Math.floor(billableM3 + 1e-9))
  const components: Record<TariffComponent, number> = {
    acueducto: tariffs.fixed.acueducto,
    alcantarillado: include.alcantarillado ? tariffs.fixed.alcantarillado : 0,
    hidrantes: 0,
    tprh: 0,
  }

  const blocks: BillBlockLine[] = []
  let previousLimit = 0

  for (let index = 0; index < tariffs.blocks.length; index += 1) {
    const block = tariffs.blocks[index]
    const limit = block.upTo ?? consumption
    const units = Math.max(0, Math.min(consumption, limit) - previousLimit)
    previousLimit = limit

    if (units === 0) {
      blocks.push({
        index,
        upTo: block.upTo,
        units: 0,
        acueducto: 0,
        alcantarillado: 0,
        hidrantes: 0,
        tprh: 0,
        total: 0,
      })
      continue
    }

    const line: BillBlockLine = {
      index,
      upTo: block.upTo,
      units,
      acueducto: units * block.acueducto,
      alcantarillado: include.alcantarillado ? units * block.alcantarillado : 0,
      hidrantes: include.hidrantes ? units * block.hidrantes : 0,
      tprh: include.tprh ? units * block.tprh : 0,
      total: 0,
    }
    line.total = line.acueducto + line.alcantarillado + line.hidrantes + line.tprh

    components.acueducto += line.acueducto
    components.alcantarillado += line.alcantarillado
    components.hidrantes += line.hidrantes
    components.tprh += line.tprh
    blocks.push(line)

    if (block.upTo === null || consumption <= block.upTo) break
  }

  const crossesIvaThreshold = consumption > tariffs.iva.thresholdM3
  const iva = crossesIvaThreshold ? components[tariffs.iva.appliesTo] * tariffs.iva.rate : 0
  const subtotal =
    components.acueducto + components.alcantarillado + components.hidrantes + components.tprh
  const total = subtotal + iva

  return {
    billableM3: consumption,
    blocks,
    components: { ...components, total },
    fixed: { ...tariffs.fixed },
    iva,
    subtotal,
    total,
    displayTotal: Math.ceil(total - 1e-9),
    crossesIvaThreshold,
  }
}

/** Factura usando la lectura actual y la base del ciclo. */
export function billForReadings(
  currentReading: number,
  baseReading: number,
  tariffs: Tariffs,
): Bill {
  return calcBill(billableConsumption(currentReading, baseReading), tariffs)
}

/** m³ que faltan para cada umbral (null si ya se pasó). */
export function metersToThreshold(billableM3: number): {
  fifteen: number | null
  thirty: number | null
  sixty: number | null
} {
  const to = (limit: number) => (billableM3 < limit ? limit - billableM3 : null)
  return { fifteen: to(15), thirty: to(30), sixty: to(60) }
}

/** Costo aproximado de un consumo diario, sin cargo fijo. */
export function dailyApproximateCost(
  deltaM3: number,
  billableM3: number,
  tariffs: Tariffs,
): number {
  const block = tariffs.blocks[blockIndexForM3(Math.max(1, billableM3), tariffs)]
  const combined =
    block.acueducto +
    (tariffs.include.alcantarillado ? block.alcantarillado : 0) +
    (tariffs.include.hidrantes ? block.hidrantes : 0) +
    (tariffs.include.tprh ? block.tprh : 0)
  const iva = billableM3 >= tariffs.iva.thresholdM3 ? block.acueducto * tariffs.iva.rate : 0
  return Math.max(0, deltaM3) * (combined + iva)
}

/** Un consumo negativo sugiere una lectura o base mal cargada. */
export function isSuspectConsumption(currentReading: number, baseReading: number): boolean {
  return currentReading < baseReading
}
