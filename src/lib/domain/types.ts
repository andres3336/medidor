/** Tipos del dominio Medidor AYA. Los derivados NO se persisten: se recalculan. */

export type ReadingSource = 'sheet' | 'app'

export type Reading = {
  id: string
  /** ISO 8601 con offset -06:00 */
  at: string
  /** Medición del medidor, m³ con 3 decimales */
  value: number
  note: string
  tags: string[]
  flag: boolean
  source?: ReadingSource
  createdAt: string
  updatedAt: string
  /** Tombstone heredado; la UI nueva no borra, solo edita */
  deleted: boolean
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

/**
 * Ciclo de facturación derivado, no persistido.
 * La ventana es siempre 20 → 20 y la base es la última medición anterior al 20.
 */
export type Cycle = {
  /** "2026-10" */
  id: string
  label: string
  startAt: string
  endAt: string
  /** Última medición antes del inicio; si no existe, la primera del ciclo */
  baseValue: number | null
  baseReadingAt: string | null
  finalReading: number | null
  finalReadingAt: string | null
  readingsCount: number
  open: boolean
}

export type AppState = {
  schema: number
  updatedAt: string
  readings: Reading[]
}

export type DayPoint = {
  day: string
  /** ISO de la última lectura del día */
  at: string
  reading: number
  /** L/día normalizado por el intervalo from el día anterior con datos */
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

export type Anomaly = {
  id: string
  day: string
  at: string
  litersPerDay: number
  multiplier: number
  severity: 'warn' | 'danger'
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

export type Projection = {
  cycle: Cycle
  elapsedDays: number
  remainingDays: number
  currentExactM3: number
  currentBillableM3: number
  currentBill: Bill
  /** Promedio L/día de los últimos días del ciclo; es el what-if */
  rateLitersPerDay: number
  rateSampleDays: number
  projectedM3: number
  projectedBillableM3: number
  projectedBill: Bill
  m3ToNextThreshold: { fifteen: number | null; thirty: number | null; sixty: number | null }
  overdueDays: number
}

export type CycleSeriesPoint = {
  /** Días desde el inicio del ciclo */
  index: number
  at: string
  m3: number
}

export type CycleSeries = {
  cycle: Cycle
  points: CycleSeriesPoint[]
  projected: CycleSeriesPoint[]
  totalM3: number
  endIndex: number
}
