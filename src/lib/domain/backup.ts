import type { AppState, Cycle, Reading, Settings } from './types'
import { defaultSettings } from './settings'
import { nowIso } from './dates'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeReading(value: unknown, index: number): Reading {
  if (!isRecord(value)) throw new Error(`Lectura ${index + 1} inválida`)
  const at = str(value.at)
  if (!at || Number.isNaN(Date.parse(at))) throw new Error(`Lectura ${index + 1}: fecha inválida`)
  const readingValue = num(value.value, Number.NaN)
  if (!Number.isFinite(readingValue) || readingValue < 0) {
    throw new Error(`Lectura ${index + 1}: medición inválida`)
  }
  return {
    id: str(value.id) || `r-${Date.parse(at)}-${readingValue.toFixed(3)}`,
    at,
    value: readingValue,
    note: str(value.note),
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    flag: value.flag === true,
    source: value.source === 'data.csv' || value.source === 'app' ? value.source : undefined,
    createdAt: str(value.createdAt, nowIso()),
    updatedAt: str(value.updatedAt, nowIso()),
    deleted: value.deleted === true,
  }
}

function normalizeCycle(value: unknown, index: number): Cycle {
  if (!isRecord(value)) throw new Error(`Ciclo ${index + 1} inválido`)
  const id = str(value.id)
  const startAt = str(value.startAt)
  if (!id || !startAt || Number.isNaN(Date.parse(startAt))) {
    throw new Error(`Ciclo ${index + 1}: id o fecha de inicio inválidos`)
  }
  const endAt = value.endAt === null ? null : str(value.endAt)
  if (endAt !== null && Number.isNaN(Date.parse(endAt))) {
    throw new Error(`Ciclo ${index + 1}: fecha de cierre inválida`)
  }
  return {
    id,
    label: str(value.label, id),
    startAt,
    endAt,
    baseValue: num(value.baseValue),
    closedAt: value.closedAt === null ? null : str(value.closedAt) || null,
    finalReading: typeof value.finalReading === 'number' ? value.finalReading : undefined,
    billedM3: typeof value.billedM3 === 'number' ? value.billedM3 : undefined,
    actualBill: isRecord(value.actualBill)
      ? {
          total: num(value.actualBill.total),
          billedM3: num(value.actualBill.billedM3),
          paidAt: str(value.actualBill.paidAt, nowIso()),
          note: typeof value.actualBill.note === 'string' ? value.actualBill.note : undefined,
        }
      : undefined,
    adjustments: Array.isArray(value.adjustments)
      ? value.adjustments.filter(isRecord).map((item) => ({
          at: str(item.at, nowIso()),
          field: item.field as Cycle['adjustments'][number]['field'],
          oldValue:
            typeof item.oldValue === 'number' || typeof item.oldValue === 'string'
              ? item.oldValue
              : '',
          newValue:
            typeof item.newValue === 'number' || typeof item.newValue === 'string'
              ? item.newValue
              : '',
          reason: str(item.reason),
        }))
      : [],
  }
}

function normalizeSettings(value: unknown): Settings {
  const base = defaultSettings()
  if (!isRecord(value)) return base

  const tariffs =
    isRecord(value.tariffs) && Array.isArray(value.tariffs.blocks)
      ? ({
          ...base.tariffs,
          ...value.tariffs,
          blocks: value.tariffs.blocks.filter(isRecord).map((block) => ({
            upTo: typeof block.upTo === 'number' ? block.upTo : null,
            acueducto: num(block.acueducto),
            alcantarillado: num(block.alcantarillado),
            hidrantes: num(block.hidrantes),
            tprh: num(block.tprh),
          })),
          fixed: {
            ...base.tariffs.fixed,
            ...(isRecord(value.tariffs.fixed) ? value.tariffs.fixed : {}),
          },
          iva: { ...base.tariffs.iva, ...(isRecord(value.tariffs.iva) ? value.tariffs.iva : {}) },
          include: {
            ...base.tariffs.include,
            ...(isRecord(value.tariffs.include) ? value.tariffs.include : {}),
          },
        } as Settings['tariffs'])
      : base.tariffs

  return {
    ...base,
    ...value,
    cycleDay: Math.min(28, Math.max(1, num(value.cycleDay, base.cycleDay))),
    decimals: { ...base.decimals, ...(isRecord(value.decimals) ? value.decimals : {}) },
    tariffs,
    projection: {
      ...base.projection,
      ...(isRecord(value.projection) ? value.projection : {}),
    },
    outlier: { ...base.outlier, ...(isRecord(value.outlier) ? value.outlier : {}) },
    flow: { ...base.flow, ...(isRecord(value.flow) ? value.flow : {}) },
    note: { ...base.note, ...(isRecord(value.note) ? value.note : {}) },
    gist: { ...base.gist, ...(isRecord(value.gist) ? value.gist : {}) },
    acknowledgedGaps: Array.isArray(value.acknowledgedGaps)
      ? value.acknowledgedGaps.filter((day): day is string => typeof day === 'string')
      : [],
  } as Settings
}

/**
 * Valida y normaliza un backup o el estado guardado en IndexedDB.
 * Lanza un error con mensaje claro si el estado dejaría la app inutilizable.
 */
export function normalizeAppState(value: unknown): AppState {
  if (!isRecord(value)) throw new Error('El archivo no contiene un estado válido')
  if (value.schema !== 1) throw new Error('Versión de backup no soportada')
  if (!Array.isArray(value.readings)) throw new Error('Falta la lista de lecturas')
  if (!Array.isArray(value.cycles) || value.cycles.length === 0) {
    throw new Error('Falta la lista de ciclos')
  }

  const cycles = value.cycles.map(normalizeCycle)
  if (!cycles.some((cycle) => cycle.endAt === null)) {
    throw new Error('El backup no tiene un ciclo abierto')
  }

  return {
    schema: 1,
    updatedAt: str(value.updatedAt, nowIso()),
    settings: normalizeSettings(value.settings),
    cycles,
    readings: value.readings.map(normalizeReading),
  }
}
