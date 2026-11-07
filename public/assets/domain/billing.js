import { blockIndexForM3 } from './tariffs.js'

export function exactConsumption(currentReading, baseReading) {
  return currentReading - baseReading
}

/** What AYA bills: truncates each reading to whole m³ and subtracts. */
export function billableConsumption(currentReading, baseReading) {
  return Math.max(0, Math.floor(currentReading + 1e-9) - Math.floor(baseReading + 1e-9))
}

/**
 * Estimated bill.
 * Key rule: once billable consumption crosses the threshold, IVA applies to
 * the WHOLE aqueduct (blocks + fixed charge), not just the marginal block.
 */
export function calcBill(billableM3, tariffs, options = {}) {
  const include = options.include ?? tariffs.include
  const consumption = Math.max(0, Math.floor(billableM3 + 1e-9))
  const components = {
    acueducto: tariffs.fixed.acueducto,
    alcantarillado: include.alcantarillado ? tariffs.fixed.alcantarillado : 0,
    hidrantes: 0,
    tprh: 0,
  }

  const blocks = []
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

    const line = {
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
  const subtotal = components.acueducto + components.alcantarillado + components.hidrantes + components.tprh
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

/** Bill using the current reading and the cycle base. */
export function billForReadings(currentReading, baseReading, tariffs) {
  return calcBill(billableConsumption(currentReading, baseReading), tariffs)
}

/** m³ left to each threshold (null once it has been passed). */
export function metersToThreshold(billableM3) {
  const to = (limit) => (billableM3 < limit ? limit - billableM3 : null)
  return { fifteen: to(15), thirty: to(30), sixty: to(60) }
}

/** Approximate cost of one day's consumption, without the fixed charge. */
export function dailyApproximateCost(deltaM3, billableM3, tariffs) {
  const block = tariffs.blocks[blockIndexForM3(Math.max(1, billableM3), tariffs)]
  const combined =
    block.acueducto +
    (tariffs.include.alcantarillado ? block.alcantarillado : 0) +
    (tariffs.include.hidrantes ? block.hidrantes : 0) +
    (tariffs.include.tprh ? block.tprh : 0)
  const iva = billableM3 >= tariffs.iva.thresholdM3 ? block.acueducto * tariffs.iva.rate : 0
  return Math.max(0, deltaM3) * (combined + iva)
}

/** Negative consumption suggests a mis-entered reading or base. */
export function isSuspectConsumption(currentReading, baseReading) {
  return currentReading < baseReading
}
