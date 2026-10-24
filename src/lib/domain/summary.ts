import type {
  Anomaly,
  Baseline,
  Cycle,
  DayPoint,
  FlowStats,
  LeakSignal,
  Projection,
  Reading,
  Settings,
} from './types'
import { cycleReadings } from './cycles'
import { formatDateTime, formatDate, relativeDayLabel } from './dates'
import { formatLiters, formatLph, formatM3, formatMoney } from './format'
import { COMPONENT_SHORT, TARIFF_COMPONENTS } from './tariffs'
import { anomalySentence, multiplierFor } from './anomalies'
import { leakSignalText } from './notes'

export type SummaryInput = {
  settings: Settings
  cycle: Cycle
  readings: Reading[]
  days: DayPoint[]
  baseline: Baseline
  anomalies: Anomaly[]
  flow: FlowStats
  signals: LeakSignal[]
  projection: Projection | null
  yesterday: DayPoint | null
  closePending: boolean
}

/**
 * `resumen.md` para pegar en un chat. Se genera aparte: no cambia el CSV canónico.
 */
export function buildSummaryMarkdown(input: SummaryInput): string {
  const { settings, cycle, readings, baseline, anomalies, flow, signals, projection, yesterday } =
    input
  const inCycle = cycleReadings(readings, cycle)
  const last = inCycle[inCycle.length - 1] ?? null
  const lines: string[] = []

  lines.push('# Medidor AYA — resumen para análisis', '')
  lines.push('## Configuración')
  lines.push(
    `- Ciclo: ${formatDateTime(cycle.startAt)} → ${cycle.endAt ? formatDateTime(cycle.endAt) : 'abierto'}`,
  )
  lines.push(`- Base: ${formatM3(cycle.baseValue)} m³`)
  lines.push(`- Cierre pendiente: ${input.closePending ? 'sí' : 'no'}`)
  lines.push('- Redondeo: floor de cada lectura')
  lines.push(`- Tarifas: ${settings.tariffs.source} (${settings.tariffs.effectiveFrom})`)
  lines.push(
    `- IVA: ${Math.round(settings.tariffs.iva.rate * 100)}% sobre acueducto total si consumo > ${settings.tariffs.iva.thresholdM3} m³`,
  )
  lines.push('')

  lines.push('## Resumen')
  lines.push(
    `- Última lectura: ${last ? `${formatM3(last.value)} m³ (${formatDateTime(last.at)})` : 'sin lecturas'}`,
  )
  if (projection) {
    lines.push(`- Consumo exacto: ${formatM3(projection.currentExactM3)} m³`)
    lines.push(`- Consumo facturable: ${projection.currentBillableM3} m³`)
  }
  if (yesterday) {
    lines.push(
      `- Consumo de ayer: ${formatLiters(yesterday.litersPerDay)} (≈ ${multiplierFor(
        yesterday.litersPerDay,
        baseline,
      )}× la mediana de ${formatLiters(baseline.median)}/día)`,
    )
  }
  lines.push(`- Flujo basal: ${formatLph(flow.basalLph)}`)
  lines.push(
    `- Muestra de la mediana: ${baseline.sampleSize} días${baseline.sufficient ? '' : ' (insuficiente)'}`,
  )
  lines.push('')

  lines.push('## Anomalías y conclusiones')
  if (anomalies.length === 0) {
    lines.push('- Sin outliers diarios en la ventana analizada.')
  } else {
    for (const anomaly of anomalies) {
      lines.push(`- ${formatDate(anomaly.at)}: ${anomalySentence(anomaly, baseline)}`)
    }
  }
  lines.push('')

  lines.push('## Señales de fuga')
  if (signals.length === 0) {
    lines.push('- Sin señales claras en las notas.')
  } else {
    for (const signal of signals) {
      lines.push(
        `- ${formatDate(signal.at)}: ${leakSignalText(signal)} ${signal.unexplainedLiters > 0 ? `≈ ${formatLph(signal.lph)}.` : ''}`,
      )
    }
  }
  lines.push(
    `- Flujo basal: ${formatLph(flow.basalLph)}. Pérdida estimada: ${formatM3(flow.monthlyLossM3, 2)} m³/mes ≈ ${formatMoney(flow.monthlyCost)}/mes.`,
  )
  lines.push('')

  if (projection) {
    lines.push('## Factura estimada')
    lines.push(`- A hoy: ${formatMoney(projection.currentBill.displayTotal)}`)
    lines.push(
      `- Esperada al cierre: ${formatMoney(projection.scenarios[0].bill.displayTotal)} (${projection.scenarios[0].billableM3} m³)`,
    )
    lines.push(`- Peor escenario: ${formatMoney(projection.worst.bill.displayTotal)}`)
    lines.push('- Nota: estimación; el recibo real manda.')
    lines.push('')

    lines.push('## Desglose de factura (a hoy)')
    lines.push('| Componente | Monto |')
    lines.push('|---|---:|')
    for (const component of TARIFF_COMPONENTS) {
      lines.push(
        `| ${COMPONENT_SHORT[component]} | ${formatMoney(projection.currentBill.components[component])} |`,
      )
    }
    lines.push(`| IVA | ${formatMoney(projection.currentBill.iva)} |`)
    lines.push(`| **Total** | **${formatMoney(projection.currentBill.displayTotal)}** |`)
    lines.push('')
  }

  lines.push('## Lecturas del ciclo')
  lines.push('| fecha | medicion | litros | L/h | nota |')
  lines.push('|---|---:|---:|---:|---|')
  inCycle.forEach((reading, index) => {
    const previous = index > 0 ? inCycle[index - 1] : null
    const liters = previous ? (reading.value - previous.value) * 1000 : 0
    const hours = previous ? (Date.parse(reading.at) - Date.parse(previous.at)) / 3_600_000 : 0
    const lph = hours > 0 ? liters / hours : 0
    lines.push(
      `| ${formatDateTime(reading.at)} | ${formatM3(reading.value)} | ${Math.round(liters)} | ${previous ? formatLph(lph) : '—'} | ${reading.note.replace(/\|/g, '/')} |`,
    )
  })
  lines.push('')

  lines.push('## Notas y flags')
  const flagged = inCycle.filter((reading) => reading.flag)
  if (flagged.length === 0) lines.push('- Sin flags.')
  else
    for (const reading of flagged)
      lines.push(`- ${relativeDayLabel(reading.at)}: ${reading.note || 'sin nota'}`)

  return `${lines.join('\n')}\n`
}
