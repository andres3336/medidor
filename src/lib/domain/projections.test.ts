import { describe, expect, it } from 'vitest'
import { buildProjection } from './projections'
import { buildDailySeries } from './readings'
import { seedReadings } from './seed'
import { defaultSettings, seedCycles } from './settings'
import { currentCycle } from './cycles'
import { buildConclusions } from './conclusions'
import { computeBaseline, detectAnomalies } from './anomalies'
import { computeFlowStats } from './flow'
import { detectLeakSignals } from './notes'
import { buildIntervals } from './readings'
import { buildSummaryMarkdown } from './summary'
import { findGaps } from './gaps'

const settings = defaultSettings()
const readings = seedReadings()
const cycle = currentCycle(seedCycles())!
const now = new Date('2026-10-24T12:00:00-06:00')
const days = buildDailySeries(readings)
const baseline = computeBaseline(days, {
  windowDays: settings.baselineWindowDays,
  multiplier: settings.outlier.multiplier,
  madFactor: settings.outlier.madFactor,
})
const projection = buildProjection({ cycle, readings, days, settings, now })
const intervals = buildIntervals(readings)

describe('proyecciones', () => {
  it('calcula consumo actual y tres escenarios', () => {
    expect(projection).not.toBeNull()
    expect(projection!.currentExactM3).toBeCloseTo(2.794, 3)
    expect(projection!.currentBillableM3).toBe(3)
    expect(projection!.currentBill.total).toBeCloseTo(5819, 2)
    expect(projection!.scenarios.map((item) => item.id)).toEqual(['average', 'recent', 'worst'])
    expect(projection!.worst.bill.total).toBeGreaterThanOrEqual(projection!.scenarios[0].bill.total)
  })

  it('proyecta el salto de IVA cuando el ritmo lo cruza', () => {
    const bigCycle = { ...cycle, baseValue: 0 }
    const manyReadings = buildDailySeries(
      Array.from({ length: 25 }, (_, index) => ({
        id: `r${index}`,
        at: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00-06:00`,
        value: index * 0.4,
        note: '',
        tags: [],
        flag: false,
        createdAt: '',
        updatedAt: '',
        deleted: false,
      })),
    )
    const result = buildProjection({
      cycle: bigCycle,
      readings: manyReadings.map((day) => {
        return {
          id: day.day,
          at: day.at,
          value: day.reading,
          note: '',
          tags: [],
          flag: false,
          createdAt: '',
          updatedAt: '',
          deleted: false,
        }
      }),
      days: manyReadings,
      settings,
      now: new Date('2026-10-25T08:00:00-06:00'),
    })
    expect(result).not.toBeNull()
    expect(result!.scenarios[0].crossesIvaThreshold).toBe(true)
    expect(result!.scenarios[0].ivaCrossDate).not.toBeNull()
  })
})

describe('conclusiones y resumen', () => {
  const anomalies = detectAnomalies(days, baseline, {
    billableM3: projection!.currentBillableM3,
    tariffs: settings.tariffs,
    settings,
  })
  const flow = computeFlowStats(intervals, {
    billableM3: projection!.currentBillableM3,
    tariffs: settings.tariffs,
    settings,
  })
  const signals = detectLeakSignals(intervals, settings)
  const gaps = findGaps(readings, cycle, settings, now)

  it('genera conclusiones en lenguaje natural', () => {
    const conclusions = buildConclusions({
      yesterday: days[days.length - 1] ?? null,
      baseline,
      anomalies,
      leakSignals: signals,
      flow,
      projection,
      closeDue: false,
      gapDays: gaps.missingDays.length,
    })
    expect(conclusions.length).toBeGreaterThan(0)
    expect(conclusions.some((item) => /mediana|fuga|flujo|días/i.test(item.title))).toBe(true)
    expect(conclusions.every((item) => !item.title.includes('NaN'))).toBe(true)
  })

  it('genera resumen con secciones y sin columnas derivadas en CSV', () => {
    const markdown = buildSummaryMarkdown({
      settings,
      cycle,
      readings,
      days,
      baseline,
      anomalies,
      flow,
      signals,
      projection,
      yesterday: days[days.length - 1] ?? null,
      closePending: false,
    })
    expect(markdown).toContain('# Medidor AYA — resumen para análisis')
    expect(markdown).toContain('## Señales de fuga')
    expect(markdown).toContain('## Factura estimada')
    expect(markdown).toContain('| Acueducto |')
    expect(markdown).toContain('estimación')
  })

  it('encuentra días faltantes y respeta los ack', () => {
    const later = new Date('2026-10-25T09:00:00-06:00')
    const gap = findGaps(readings, cycle, settings, later)
    expect(gap.missingDays).toEqual(['2026-10-24'])
    expect(gap.missingYesterday).toBe(true)
    expect(gap.severity).toBe('danger')

    const acknowledged = findGaps(
      readings,
      cycle,
      { ...settings, acknowledgedGaps: ['2026-10-24'] },
      later,
    )
    expect(acknowledged.unacknowledged).toEqual([])
  })
})
