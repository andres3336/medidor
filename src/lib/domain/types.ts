/** Tipos del dominio Medidor AYA. Los derivados NO se persisten: se recalculan. */

export type ReadingSource = 'data.csv' | 'app'

export type Reading = {
  id: string
  /** ISO 8601 con offset -06:00 */
  at: string
  /** m³ con 3 decimales */
  value: number
  note: string
  tags: string[]
  flag: boolean
  source?: ReadingSource
  createdAt: string
  updatedAt: string
  /** Tombstone para sincronización */
  deleted: boolean
}

export type ReadingMeta = {
  flag: boolean
  tags: string[]
}

export type TariffComponent = 'acueducto' | 'alcantarillado' | 'hidrantes' | 'tprh'

export type TariffBlock = {
  /** null = último bloque, sin tope */
  upTo: number | null
  acueducto: number
  alcantarillado: number
  hidrantes: number
  tprh: number
}

export type Tariffs = {
  blocks: TariffBlock[]
  fixed: Record<TariffComponent, number>
  iva: {
    rate: number
    thresholdM3: number
    appliesTo: 'acueducto'
  }
  include: Record<'alcantarillado' | 'hidrantes' | 'tprh', boolean>
  source: string
  effectiveFrom: string
}

export type CycleAdjustment = {
  at: string
  field: 'baseValue' | 'finalReading' | 'billedM3' | 'actualBill' | 'startAt'
  oldValue: number | string
  newValue: number | string
  reason: string
}

export type Cycle = {
  /** "2026-10" */
  id: string
  label: string
  startAt: string
  endAt: string | null
  baseValue: number
  closedAt: string | null
  finalReading?: number
  billedM3?: number
  actualBill?: {
    total: number
    billedM3: number
    paidAt: string
    note?: string
  }
  adjustments: CycleAdjustment[]
}

export type Settings = {
  cycleDay: number
  timezone: 'America/Costa_Rica'
  billingRounding: 'floor-reading'
  currency: 'CRC'
  decimals: { m3: number; liters: number; flow: number; money: number }
  tariffs: Tariffs
  projection: {
    method: 'worst' | 'expected' | 'both'
    safetyMarginPct: number
    useMaxDaily: boolean
  }
  baselineWindowDays: number
  outlier: {
    /** multiplicador sobre la mediana */
    multiplier: number
    /** desviaciones MAD */
    madFactor: number
  }
  flow: {
    warningLph: number
    dangerLph: number
    outlierLph: number
  }
  note: {
    unexplainedWarnLiters: number
  }
  gapWarnHours: number
  acknowledgedGaps: string[]
  theme: 'auto' | 'light' | 'dark'
  gist: {
    id: string | null
    url: string | null
    lastSyncAt: string | null
  }
}

export type AppState = {
  schema: number
  updatedAt: string
  settings: Settings
  cycles: Cycle[]
  readings: Reading[]
}

/** Bloque de estado que viaja dentro de `medidor.md`. */
export type GistState = {
  schema: number
  updatedAt: string
  settings: Settings
  cycles: Cycle[]
  readingMeta: Record<string, ReadingMeta>
  deletedReadings: string[]
}

export type DayPoint = {
  day: string
  /** ISO de la última lectura del día */
  at: string
  reading: number
  /** L/día normalizado por el intervalo desde el día anterior con datos */
  litersPerDay: number
  liters: number
  hours: number
  gapDays: number
  note: string
}

export type Interval = {
  from: Reading
  to: Reading
  deltaM3: number
  liters: number
  hours: number
  lph: number
}

export type Baseline = {
  median: number
  p25: number
  p75: number
  mad: number
  sampleSize: number
  sufficient: boolean
  fallback: 'cycle-average' | null
  windowDays: number
}

export type LeakSignal = {
  at: string
  note: string
  explainedLiters: number
  measuredLiters: number
  unexplainedLiters: number
  lph: number
  kind: 'unexplained' | 'meter-spinning' | 'stored-water' | 'expected-zero'
  severity: 'info' | 'warn' | 'danger'
}

export type FlowStats = {
  basalLph: number
  minPositiveLph: number
  nocturnalLph: number | null
  sampleSize: number
  monthlyLossM3: number
  monthlyCost: number
  severity: 'ok' | 'warn' | 'danger'
}

export type Anomaly = {
  id: string
  at: string
  litersPerDay: number
  multiplier: number
  normalDaysEquivalent: number
  approximateCost: number
  previousCost: number | null
  note: string
  severity: 'warn' | 'danger'
  action: string
}

export type BillBlockLine = {
  index: number
  upTo: number | null
  units: number
  acueducto: number
  alcantarillado: number
  hidrantes: number
  tprh: number
  total: number
}

export type Bill = {
  billableM3: number
  blocks: BillBlockLine[]
  components: Record<TariffComponent, number> & { total: number }
  fixed: Record<TariffComponent, number>
  iva: number
  subtotal: number
  total: number
  /** total con redondeo hacia arriba al colón, para mostrar */
  displayTotal: number
  crossesIvaThreshold: boolean
}

export type ProjectionScenario = {
  id: 'average' | 'recent' | 'worst'
  label: string
  rateLitersPerDay: number
  projectedM3: number
  billableM3: number
  bill: Bill
  crossesIvaThreshold: boolean
  /** fecha estimada de cruce de los 30 m³, si aplica */
  ivaCrossDate: string | null
}

export type Projection = {
  cycle: Cycle
  elapsedDays: number
  remainingDays: number
  currentExactM3: number
  currentBillableM3: number
  currentBill: Bill
  scenarios: ProjectionScenario[]
  worst: ProjectionScenario
  m3ToNextThreshold: { fifteen: number | null; thirty: number | null; sixty: number | null }
  overdueDays: number
}
