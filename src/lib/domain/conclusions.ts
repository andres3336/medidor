import type { Anomaly, Baseline, Cycle, DayPoint, FlowStats, LeakSignal, Projection } from './types'
import { formatLiters, formatLph, formatM3, formatMoney, formatMultiplier } from './format'
import { leakSignalText } from './notes'
import { relativeDayLabel } from './dates'

export type ConclusionTone = 'ok' | 'info' | 'warn' | 'danger'

export type Conclusion = {
  id: string
  tone: ConclusionTone
  title: string
  detail: string
  action?: string
}

export type ConclusionContext = {
  yesterday: DayPoint | null
  baseline: Baseline
  anomalies: Anomaly[]
  leakSignals: LeakSignal[]
  flow: FlowStats
  projection: Projection | null
  closeDue: boolean
  gapDays: number
}

/**
 * Conclusiones en lenguaje natural, sin falsa precisión.
 * Ordenadas por urgencia: primero lo que hay que hacer hoy.
 */
export function buildConclusions(context: ConclusionContext): Conclusion[] {
  const out: Conclusion[] = []
  const { yesterday, baseline, anomalies, flow, projection } = context

  if (yesterday) {
    const multiplier = baseline.median > 0 ? yesterday.litersPerDay / baseline.median : 0
    const isAnomaly = anomalies.some((anomaly) => anomaly.at === yesterday.at)
    if (isAnomaly) {
      out.push({
        id: 'yesterday-anomaly',
        tone: 'danger',
        title: `${relativeDayLabel(yesterday.day)}: ${formatLiters(yesterday.litersPerDay)} — ${formatMultiplier(
          multiplier,
        )} tu mediana`,
        detail: `Tu mediana es ${formatLiters(baseline.median)}/día. Equivale a ${formatMultiplier(
          multiplier,
        )} días normales en uno.`,
        action: anomalies.find((anomaly) => anomaly.at === yesterday.at)?.action,
      })
    } else if (baseline.sufficient) {
      out.push({
        id: 'yesterday-normal',
        tone: 'ok',
        title: `${relativeDayLabel(yesterday.day)} fue normal: ${formatLiters(yesterday.litersPerDay)}`,
        detail: `Tu mediana reciente es ${formatLiters(baseline.median)}/día (banda ${formatLiters(
          baseline.p25,
        )}–${formatLiters(baseline.p75)}).`,
      })
    }
  } else if (baseline.fallback === 'cycle-average') {
    out.push({
      id: 'baseline-insufficient',
      tone: 'info',
      title: 'Todavía no hay suficiente historia para una mediana confiable',
      detail:
        'Uso el promedio del ciclo como referencia provisional. Con 5 días de lecturas la mediana mejora.',
    })
  }

  if (flow.severity !== 'ok') {
    out.push({
      id: 'leak-flow',
      tone: flow.severity === 'danger' ? 'danger' : 'warn',
      title: `Flujo basal ${formatLph(flow.basalLph)} ≈ ${formatM3(
        flow.monthlyLossM3,
        2,
      )} m³/mes ≈ ${formatMoney(flow.monthlyCost)}/mes si sigue igual`,
      detail:
        flow.severity === 'danger'
          ? 'El flujo continuo es alto. Revisá llave-medidor, llave-ducha y casa2 antes de que cierre el ciclo.'
          : 'Puede ser una llave abierta o una fuga pequeña. Compará con el mínimo observado.',
      action: 'Revisá llave-medidor, llave-ducha y casa2',
    })
  }

  const topSignal = [...context.leakSignals].sort(
    (a, b) => b.unexplainedLiters - a.unexplainedLiters,
  )[0]
  if (topSignal) {
    out.push({
      id: `leak-signal-${topSignal.at}`,
      tone: topSignal.severity === 'danger' ? 'danger' : 'warn',
      title: leakSignalText(topSignal),
      detail: `Intervalo con flujo no explicado de ${formatLph(topSignal.lph)}.`,
      action: 'Revisá la nota de esa lectura y la llave correspondiente',
    })
  }

  if (projection) {
    if (projection.worst.crossesIvaThreshold) {
      out.push({
        id: 'iva-threshold',
        tone: 'warn',
        title: 'La proyección cruza los 30 m³: el IVA sube ~₡5,215',
        detail: `Peor escenario: ${projection.worst.billableM3} m³ → ${formatMoney(
          projection.worst.bill.displayTotal,
        )}. Si el ciclo cerrara hoy: ${formatMoney(projection.currentBill.displayTotal)}.`,
      })
    } else if (
      projection.m3ToNextThreshold.thirty != null &&
      projection.m3ToNextThreshold.thirty <= 3
    ) {
      out.push({
        id: 'iva-near',
        tone: 'warn',
        title: `Estás a ${formatM3(projection.m3ToNextThreshold.thirty, 0)} m³ de los 30`,
        detail: 'Si cruzás ese umbral, el IVA del 13% se aplica a todo el acueducto.',
      })
    }
  }

  if (context.gapDays > 0) {
    out.push({
      id: 'gaps',
      tone: 'warn',
      title: `${context.gapDays} ${context.gapDays === 1 ? 'día sin' : 'días sin'} lectura`,
      detail: 'La serie diaria normaliza los huecos, pero el radar pierde precisión.',
      action: 'Agregá la lectura que falta',
    })
  }

  if (context.closeDue) {
    out.push({
      id: 'close-due',
      tone: 'danger',
      title: 'Cierre de ciclo pendiente',
      detail:
        'Ya pasó el día de corte. Ajustá la lectura final y la base para no arrastrar el error.',
      action: 'Cerrar ciclo en Ajustes',
    })
  }

  return out
}

export function cycleSummarySentence(cycle: Cycle, projection: Projection | null): string {
  if (!projection) return `Ciclo ${cycle.label}: sin lecturas todavía.`
  return `Ciclo ${cycle.label}: ${formatM3(projection.currentExactM3)} m³ exactos (${projection.currentBillableM3} facturables) → ${formatMoney(
    projection.currentBill.displayTotal,
  )} a hoy.`
}
