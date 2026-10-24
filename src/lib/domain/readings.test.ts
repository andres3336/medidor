import { describe, expect, it } from 'vitest'
import { parseNoteQuantities, detectLeakSignals, suggestedAction, leakSignalText } from './notes'
import { defaultSettings } from './settings'
import type { Interval, Reading } from './types'
import { buildIntervals, buildDailySeries, dedupeReadings } from './readings'
import { makeReading } from './readings'
import { computeBaseline, detectAnomalies } from './anomalies'
import { basalFlow, computeFlowStats, nocturnalAverage } from './flow'

function reading(at: string, value: number, note = ''): Reading {
  return makeReading({ at, value, note })
}

function interval(
  fromAt: string,
  fromValue: number,
  toAt: string,
  toValue: number,
  note = '',
): Interval {
  const from = reading(fromAt, fromValue)
  const to = reading(toAt, toValue, note)
  const hours = (Date.parse(to.at) - Date.parse(from.at)) / 3_600_000
  return {
    from,
    to,
    deltaM3: to.value - from.value,
    liters: (to.value - from.value) * 1000,
    hours,
    lph: ((to.value - from.value) * 1000) / hours,
  }
}

describe('notas y fugas', () => {
  it('extrae cantidades en litros', () => {
    expect(parseNoteQuantities('se consumieron 6 litros de agua').liters).toBe(6)
    expect(parseNoteQuantities('se guardó cerca de 20L+5L+10L de agua').liters).toBe(35)
  })

  it('interpreta decimales sueltos como m³', () => {
    expect(parseNoteQuantities('debería ser 0 pero es 0.004').liters).toBe(4)
  })

  it('detecta el medidor girando', () => {
    const parsed = parseNoteQuantities('el medidor sigue dando vueltas cochinada')
    expect(parsed.spinning).toBe(true)
  })

  it('23 L medidos vs 6 L de nota → 17 L ≈ 15.7 L/h', () => {
    const item = interval(
      '2026-10-23T08:15:00-06:00',
      103.054,
      '2026-10-23T09:20:00-06:00',
      103.077,
      'se consumieron 6 litros, revisar',
    )
    const [signal] = detectLeakSignals([item], defaultSettings())
    expect(signal.measuredLiters).toBeCloseTo(23, 3)
    expect(signal.explainedLiters).toBe(6)
    expect(signal.unexplainedLiters).toBeCloseTo(17, 1)
    expect(signal.lph).toBeCloseTo(15.7, 1)
  })

  it('35 L almacenados vs 799 L de medidor → 764 L', () => {
    const item = interval(
      '2026-10-20T10:05:00-06:00',
      100.283,
      '2026-10-21T08:45:00-06:00',
      101.082,
      'no hubo agua, en la noche se guardó cerca de 20L+5L+10L de agua',
    )
    const [signal] = detectLeakSignals([item], defaultSettings())
    expect(signal.unexplainedLiters).toBeCloseTo(764, 0)
    expect(signal.kind).toBe('stored-water')
  })

  it('marca flujo continuo aunque no haya cantidad', () => {
    const item = interval(
      '2026-10-14T22:15:00-06:00',
      95.285,
      '2026-10-14T23:15:00-06:00',
      95.289,
      'medidor dando vueltas lento, casa sin uso',
    )
    const [signal] = detectLeakSignals([item], defaultSettings())
    expect(signal.kind).toBe('meter-spinning')
    expect(signal.lph).toBeCloseTo(4, 1)
  })

  it('detecta la nota real “debería ser 0 pero es 0.004”', () => {
    const item = interval(
      '2026-10-14T22:15:00-06:00',
      95.285,
      '2026-10-14T23:15:00-06:00',
      95.289,
      'medicion nocturna chatgpt investigando despues de 1 hora porque deberia de ser 0 pero es 0.004',
    )
    const [signal] = detectLeakSignals([item], defaultSettings())
    expect(signal.kind).toBe('expected-zero')
    expect(signal.lph).toBeCloseTo(4, 1)
    expect(signal.unexplainedLiters).toBe(0)
    expect(leakSignalText(signal)).toContain('esperaba 0')
  })

  it('no genera ruido con notas sin cantidades', () => {
    const item = interval(
      '2026-10-22T07:45:00-06:00',
      101.082,
      '2026-10-23T08:15:00-06:00',
      103.054,
      'medicion diaria',
    )
    expect(detectLeakSignals([item], defaultSettings())).toEqual([])
  })

  it('sugiere la llave correcta', () => {
    expect(suggestedAction('se puso la llave-ducha en casa2')).toContain('llave-ducha')
    expect(suggestedAction('casa2 lavó')).toContain('casa2')
  })
})

describe('estadística y anomalías', () => {
  it('normaliza huecos en la serie diaria', () => {
    const readings = [
      reading('2026-10-01T08:00:00-06:00', 10),
      reading('2026-10-02T08:00:00-06:00', 10.3),
      reading('2026-10-05T08:00:00-06:00', 11.5),
    ]
    const days = buildDailySeries(readings)
    expect(days).toHaveLength(2)
    expect(days[0].day).toBe('2026-10-02')
    expect(days[0].litersPerDay).toBeCloseTo(300, 0)
    expect(days[1].day).toBe('2026-10-05')
    expect(days[1].liters).toBeCloseTo(1200, 0)
    expect(days[1].gapDays).toBe(2)
    expect(days[1].litersPerDay).toBeCloseTo(400, 0)
  })

  it('calcula mediana y banda ignorando outliers', () => {
    const days = Array.from({ length: 10 }, (_, index) => ({
      day: `2026-10-${String(index + 1).padStart(2, '0')}`,
      at: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00-06:00`,
      reading: index,
      liters: 290,
      hours: 24,
      litersPerDay: 290,
      gapDays: 0,
      note: '',
    }))
    days[9].litersPerDay = 1517
    const baseline = computeBaseline(days, { windowDays: 14, multiplier: 2, madFactor: 3 })
    expect(baseline.median).toBe(290)
    expect(baseline.sufficient).toBe(true)
    expect(baseline.p25).toBe(290)
    expect(baseline.p75).toBe(290)
  })

  it('marca baseline insuficiente con pocos días', () => {
    const days = [
      {
        day: '2026-10-01',
        at: '2026-10-01T08:00:00-06:00',
        reading: 1,
        liters: 100,
        hours: 24,
        litersPerDay: 100,
        gapDays: 0,
        note: '',
      },
    ]
    const baseline = computeBaseline(days, { windowDays: 14, multiplier: 2, madFactor: 3 }, 150)
    expect(baseline.sufficient).toBe(false)
    expect(baseline.fallback).toBe('cycle-average')
    expect(baseline.median).toBe(150)
  })

  it('detecta outlier y equivalencia en días normales', () => {
    const days = Array.from({ length: 12 }, (_, index) => ({
      day: `2026-10-${String(index + 1).padStart(2, '0')}`,
      at: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00-06:00`,
      reading: index,
      liters: 290,
      hours: 24,
      litersPerDay: 290,
      gapDays: 0,
      note: index === 11 ? 'llave-ducha abierta' : '',
    }))
    days[11].litersPerDay = 1517
    days[11].liters = 1517
    const baseline = computeBaseline(days, { windowDays: 14, multiplier: 2, madFactor: 3 })
    const anomalies = detectAnomalies(days, baseline, {
      billableM3: 3,
      tariffs: defaultSettings().tariffs,
      settings: defaultSettings(),
    })
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].multiplier).toBeCloseTo(5.2, 1)
    expect(anomalies[0].action).toContain('llave-ducha')
  })
})

describe('flujo', () => {
  it('usa p10 con muestra suficiente y mínimo con muestra pequeña', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      interval('2026-10-01T00:00:00-06:00', index, '2026-10-01T01:00:00-06:00', index + 0.01),
    )
    expect(basalFlow(many)).toBeCloseTo(10, 5)
    const few = [interval('2026-10-01T00:00:00-06:00', 0, '2026-10-01T01:00:00-06:00', 0.001)]
    expect(basalFlow(few)).toBeCloseTo(1, 5)
  })

  it('calcula promedio nocturno y costo de fuga', () => {
    const intervals = [
      interval('2026-10-01T22:00:00-06:00', 0, '2026-10-01T23:00:00-06:00', 0.004),
      interval('2026-10-02T02:00:00-06:00', 0.004, '2026-10-02T03:00:00-06:00', 0.008),
      interval('2026-10-02T12:00:00-06:00', 0.008, '2026-10-02T13:00:00-06:00', 0.05),
    ]
    expect(nocturnalAverage(intervals)).toBeCloseTo(4, 1)
    const stats = computeFlowStats(intervals, {
      billableM3: 3,
      tariffs: defaultSettings().tariffs,
      settings: defaultSettings(),
    })
    expect(stats.basalLph).toBeCloseTo(4, 1)
    expect(stats.monthlyLossM3).toBeCloseTo(2.88, 2)
    expect(stats.monthlyCost).toBeGreaterThan(0)
    expect(stats.severity).toBe('warn')
  })
})

it('deduplica y arma intervalos', () => {
  const readings = dedupeReadings([
    reading('2026-10-23T08:15:00-06:00', 103.054, 'diaria'),
    reading('2026-10-23T09:20:00-06:00', 103.077, 'extra'),
    reading('2026-10-23T09:20:00-06:00', 103.077, 'extra'),
  ])
  expect(readings).toHaveLength(2)
  const intervals = buildIntervals(readings)
  expect(intervals).toHaveLength(1)
  expect(intervals[0].liters).toBeCloseTo(23, 3)
})

it('el tombstone más reciente gana y conserva los flags', () => {
  const base = reading('2026-10-23T09:20:00-06:00', 103.077, 'extra')
  const older = { ...base, updatedAt: '2026-10-23T10:00:00-06:00', flag: true }
  const newer = { ...base, updatedAt: '2026-10-23T11:00:00-06:00', deleted: true }

  const [merged] = dedupeReadings([older, newer])
  expect(merged.deleted).toBe(true)
  expect(merged.flag).toBe(true)
})
