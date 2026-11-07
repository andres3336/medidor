export const TARIFF_COMPONENTS = ['acueducto', 'alcantarillado', 'hidrantes', 'tprh']

export const COMPONENT_LABELS = {
  acueducto: 'Aqueduct',
  alcantarillado: 'Sewer',
  hidrantes: 'Hydrants',
  tprh: 'Water resource protection (TPRH)',
}

export const COMPONENT_SHORT = {
  acueducto: 'Aqueduct',
  alcantarillado: 'Sewer',
  hidrantes: 'Hydrants',
  tprh: 'TPRH',
}

/**
 * ARESEP tariffs in force on 2026-10-23, AyA residential with sewer service.
 * The combined table the app uses is the sum of aqueduct + sewer + hydrants +
 * TPRH. Everything is read-only; it is not scraped at runtime.
 */
export const ARESEP_TARIFFS_2026_10_23 = {
  blocks: [
    { upTo: 15, acueducto: 437, alcantarillado: 408, hidrantes: 23, tprh: 5 },
    { upTo: 30, acueducto: 875, alcantarillado: 867, hidrantes: 24, tprh: 6 },
    { upTo: 60, acueducto: 1210, alcantarillado: 997, hidrantes: 26, tprh: 6 },
    { upTo: null, acueducto: 2005, alcantarillado: 1807, hidrantes: 30, tprh: 7 },
  ],
  fixed: { acueducto: 2000, alcantarillado: 1200, hidrantes: 0, tprh: 0 },
  iva: { rate: 0.13, thresholdM3: 30, appliesTo: 'acueducto' },
  include: { alcantarillado: true, hidrantes: true, tprh: true },
  source: 'ARESEP tariff calculator, AyA residential with sewer service',
  effectiveFrom: '2026-10-23',
}

export function defaultTariffs() {
  return structuredClone(ARESEP_TARIFFS_2026_10_23)
}

/** Combined rate for the block (cost of each extra m³). */
export function combinedRate(block, include = { alcantarillado: true, hidrantes: true, tprh: true }) {
  return (
    block.acueducto +
    (include.alcantarillado ? block.alcantarillado : 0) +
    (include.hidrantes ? block.hidrantes : 0) +
    (include.tprh ? block.tprh : 0)
  )
}

export function blockIndexForM3(m3, tariffs) {
  const index = tariffs.blocks.findIndex((block) => block.upTo === null || m3 <= block.upTo)
  return index === -1 ? tariffs.blocks.length - 1 : index
}

/**
 * Approximate cost of one extra m³ at the current point of the cycle.
 * No fixed charge; includes marginal IVA once the threshold is crossed.
 */
export function marginalCostPerM3(billableM3, tariffs) {
  const block = tariffs.blocks[blockIndexForM3(billableM3 + 1, tariffs)]
  const combined = combinedRate(block, tariffs.include)
  const iva = billableM3 >= tariffs.iva.thresholdM3 ? block.acueducto * tariffs.iva.rate : 0
  return combined + iva
}
