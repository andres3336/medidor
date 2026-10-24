import type { Cycle, Settings } from './types'
import { defaultTariffs } from './tariffs'

export function defaultSettings(): Settings {
  return {
    cycleDay: 20,
    timezone: 'America/Costa_Rica',
    billingRounding: 'floor-reading',
    currency: 'CRC',
    decimals: { m3: 3, liters: 0, flow: 1, money: 0 },
    tariffs: defaultTariffs(),
    projection: { method: 'worst', safetyMarginPct: 0, useMaxDaily: true },
    baselineWindowDays: 14,
    outlier: { multiplier: 2, madFactor: 3 },
    flow: { warningLph: 1, dangerLph: 5, outlierLph: 10 },
    note: { unexplainedWarnLiters: 2 },
    gapWarnHours: 36,
    acknowledgedGaps: [],
    theme: 'auto',
    gist: { id: null, url: null, lastSyncAt: null },
  }
}

/**
 * Ciclos iniciales conocidos. El anterior cierra con la lectura del 20/10 10:05
 * y el actual arranca con la misma lectura como base.
 */
export function seedCycles(): Cycle[] {
  return [
    {
      id: '2026-09',
      label: '20 sep – 20 oct',
      startAt: '2026-09-20T00:00:00-06:00',
      endAt: '2026-10-20T10:05:00-06:00',
      baseValue: 73,
      closedAt: '2026-10-20T10:05:00-06:00',
      finalReading: 100.283,
      billedM3: 27,
      adjustments: [],
    },
    {
      id: '2026-10',
      label: '20 oct – 20 nov',
      startAt: '2026-10-20T10:05:00-06:00',
      endAt: null,
      baseValue: 100.283,
      closedAt: null,
      adjustments: [],
    },
  ]
}
