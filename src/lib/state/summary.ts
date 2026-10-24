import { buildSummaryMarkdown } from '../domain/summary'
import { app } from './store.svelte'
import { deriveAnalytics } from './derive'

export function currentSummaryMarkdown(): string {
  const analytics = deriveAnalytics(app.state)
  return buildSummaryMarkdown({
    settings: app.state.settings,
    cycle: analytics.cycle,
    readings: app.state.readings,
    days: analytics.days,
    baseline: analytics.baseline,
    anomalies: analytics.anomalies,
    flow: analytics.flow,
    signals: analytics.leaks,
    projection: analytics.projection,
    yesterday: analytics.yesterday,
    closePending: analytics.closeDue,
  })
}

export function downloadFile(name: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
