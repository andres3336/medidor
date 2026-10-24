import { describe, expect, it } from 'vitest'
import type { Reading } from './types'
import {
  buildIntervals,
  buildDailySeries,
  dedupeReadings,
  makeReading,
  mergeSheetReadings,
} from './readings'
import { computeBaseline, detectAnomalies } from './anomalies'

function reading(at: string, value: number, note = ''): Reading {
  return makeReading({ at, value, note })
}

describe('serie diaria y anomalías', () => {
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
    const baseline = computeBaseline(days)
    expect(baseline.median).toBe(290)
    expect(baseline.sufficient).toBe(true)
    expect(baseline.p25).toBe(290)
    expect(baseline.p75).toBe(290)
  })

  it('marca baseline insuficiente con pocos días y usa el promedio del ciclo', () => {
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
    const baseline = computeBaseline(days, 150)
    expect(baseline.sufficient).toBe(false)
    expect(baseline.fallback).toBe('cycle-average')
    expect(baseline.median).toBe(150)
  })

  it('detecta outlier y su multiplicador', () => {
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
    const baseline = computeBaseline(days)
    const anomalies = detectAnomalies(days, baseline)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].multiplier).toBeCloseTo(5.2, 1)
    expect(anomalies[0].severity).toBe('danger')
  })
})

it('mergea la hoja sin pisar favoritos y sin borrar filas locales', () => {
  const local = [
    makeReading({
      at: '2026-10-23T09:20:00-06:00',
      value: 103.077,
      note: 'nota local',
      flag: true,
    }),
    makeReading({ at: '2026-10-24T09:07:00-06:00', value: 103.91, note: 'solo local' }),
  ]
  const remote = [
    makeReading({ at: '2026-10-23T09:20:00-06:00', value: 103.077, note: 'nota de la hoja' }),
    makeReading({ at: '2026-10-25T08:00:00-06:00', value: 104.2, note: 'nueva de la hoja' }),
  ]

  const result = mergeSheetReadings(local, remote)
  expect(result.added).toBe(1)
  expect(result.updated).toBe(1)
  expect(result.localOnly).toBe(1)

  const shared = result.readings.find((reading) => reading.value === 103.077)
  expect(shared?.note).toBe('nota de la hoja')
  expect(shared?.flag).toBe(true)
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
  expect(intervals[0].hours).toBeCloseTo(1.0833, 3)
  expect(intervals[0].lph).toBeCloseTo(21.23, 2)
})
