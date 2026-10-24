import type { TariffComponent, Tariffs } from './types'

/**
 * Tarifas ARESEP vigentes al 2026-10-23, AyA residencial con alcantarillado.
 * La tabla combinada que usa la app es la suma de acueducto + alcantarillado +
 * hidrantes + TPRH. Todo es editable en Ajustes; no se scrapea en runtime.
 */
export const ARESEP_TARIFFS_2026_10_23: Tariffs = {
  blocks: [
    { upTo: 15, acueducto: 437, alcantarillado: 408, hidrantes: 23, tprh: 5 },
    { upTo: 30, acueducto: 875, alcantarillado: 867, hidrantes: 24, tprh: 6 },
    { upTo: 60, acueducto: 1210, alcantarillado: 997, hidrantes: 26, tprh: 6 },
    { upTo: null, acueducto: 2005, alcantarillado: 1807, hidrantes: 30, tprh: 7 },
  ],
  fixed: { acueducto: 2000, alcantarillado: 1200, hidrantes: 0, tprh: 0 },
  iva: { rate: 0.13, thresholdM3: 30, appliesTo: 'acueducto' },
  include: { alcantarillado: true, hidrantes: true, tprh: true },
  source: 'ARESEP — calculadora tarifaria, AyA residencial con alcantarillado',
  effectiveFrom: '2026-10-23',
}

export const TARIFF_COMPONENTS: TariffComponent[] = [
  'acueducto',
  'alcantarillado',
  'hidrantes',
  'tprh',
]

export const COMPONENT_LABELS: Record<TariffComponent, string> = {
  acueducto: 'Acueducto',
  alcantarillado: 'Alcantarillado',
  hidrantes: 'Hidrantes',
  tprh: 'Protección del recurso hídrico',
}

export const COMPONENT_SHORT: Record<TariffComponent, string> = {
  acueducto: 'Acueducto',
  alcantarillado: 'Alcantarillado',
  hidrantes: 'Hidrantes',
  tprh: 'TPRH',
}

export function defaultTariffs(): Tariffs {
  return structuredClone(ARESEP_TARIFFS_2026_10_23)
}

/** Tarifa combinada del bloque (lo que cuesta cada m³ adicional). */
export function combinedRate(
  block: Tariffs['blocks'][number],
  include = { alcantarillado: true, hidrantes: true, tprh: true },
): number {
  return (
    block.acueducto +
    (include.alcantarillado ? block.alcantarillado : 0) +
    (include.hidrantes ? block.hidrantes : 0) +
    (include.tprh ? block.tprh : 0)
  )
}

export function blockIndexForM3(m3: number, tariffs: Tariffs): number {
  const index = tariffs.blocks.findIndex((block) => block.upTo === null || m3 <= block.upTo)
  return index === -1 ? tariffs.blocks.length - 1 : index
}

/**
 * Costo aproximado de un m³ adicional en el punto actual del ciclo.
 * Sin cargo fijo; incluye el IVA marginal cuando ya se pasó el umbral.
 */
export function marginalCostPerM3(billableM3: number, tariffs: Tariffs): number {
  const block = tariffs.blocks[blockIndexForM3(billableM3 + 1, tariffs)]
  const combined = combinedRate(block, tariffs.include)
  const iva = billableM3 >= tariffs.iva.thresholdM3 ? block.acueducto * tariffs.iva.rate : 0
  return combined + iva
}
