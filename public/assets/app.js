import { SHEET_CSV_URL } from './config.js'
import { parseReadingsCsv, serializeReadingsCsv } from './domain/csv.js'
import { deriveAnalytics } from './domain/analytics.js'
import { formatDayMonth, formatDateTime, nowIso } from './domain/dates.js'
import { formatLiters, formatM3, formatMoney, formatNumber } from './domain/format.js'
import { ARESEP_TARIFFS_2026_10_23, combinedRate } from './domain/tariffs.js'
import { HOUSE2_LEAK_LPH } from './domain/constants.js'
import { buildChartModel, renderCharts } from './charts.js'

/* ------------------------------------------------------------------ icons */

const ICON_PATHS = {
  settings: ['M4 7h9M17 7h3M4 17h3M11 17h9', 'M15 5v4M7 15v4'],
  download: ['M12 3v12M8 11l4 4 4-4M4 21h16'],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z'],
  alert: ['M12 3 2.5 20h19L12 3Z', 'M12 9v5M12 17h.01'],
  check: ['M4 12.5 9 17.5 20 6.5'],
  x: ['M6 6l12 12M18 6 6 18'],
  droplet: ['M12 3c-4.5 5.5-8 9.6-8 13a8 8 0 0 0 16 0c0-3.4-3.5-7.5-8-13Z'],
  refresh: ['M20 11a8 8 0 1 0-2.3 6.3', 'M20 5v6h-6'],
}

function icon(name, size = 20, filled = false) {
  const paths = ICON_PATHS[name] ?? []
  const body = paths.map((d) => `<path d="${d}"></path>`).join('')
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
}

/* ------------------------------------------------------------------ state */

const state = {
  readings: [],
  search: '',
  sync: { status: 'idle', remoteCount: 0, lastAt: null, error: null, inFlight: false },
}

let currentAnalytics = null
let currentModel = null

/* ------------------------------------------------------------------ theme */

const themeMedia = window.matchMedia('(prefers-color-scheme: dark)')

function storedTheme() {
  try {
    const value = localStorage.getItem('medidor.theme')
    return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

function resolvedTheme() {
  const preference = storedTheme()
  return preference === 'auto' ? (themeMedia.matches ? 'dark' : 'light') : preference
}

function applyTheme() {
  const resolved = resolvedTheme()
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0f1115' : '#f7f8fa')
}

function setTheme(preference) {
  try {
    localStorage.setItem('medidor.theme', preference)
  } catch {
    /* optional preference */
  }
  applyTheme()
  updateHeader()
  if (currentModel) renderCharts(currentModel)
}

function cycleTheme() {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')
}

themeMedia.addEventListener('change', () => {
  if (storedTheme() === 'auto') {
    applyTheme()
    updateHeader()
    if (currentModel) renderCharts(currentModel)
  }
})

/* ------------------------------------------------------------------ utils */

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )
}

function downloadFile(name, content, type = 'text/plain;charset=utf-8') {
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

let toastTimer = null

function showToast(message, ms = 2800, kind = 'ok') {
  const root = document.querySelector('#toast-root')
  if (!root) return
  root.innerHTML = `<div class="floating-toast${kind === 'error' ? ' is-error' : ''}" role="status">${icon(kind === 'error' ? 'alert' : 'check', 16)}<span>${escapeHtml(message)}</span></div>`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    root.innerHTML = ''
    toastTimer = null
  }, ms)
}

/* ------------------------------------------------------------------ shell */

function shellHtml() {
  return `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="./" aria-label="Medidor AYA, go to the start">
          <span class="brand-mark">${icon('droplet', 20, true)}</span>
          <span>
            <h1>Medidor AYA</h1>
            <p id="brand-subtitle">loading…</p>
          </span>
        </a>
        <div class="topbar-actions">
          <button class="btn btn-icon" id="theme-button" type="button" aria-label="Change theme" title="Change theme">
            ${icon(resolvedTheme() === 'dark' ? 'sun' : 'moon', 18)}
          </button>
          <button class="btn btn-icon" id="sync-button" type="button" aria-label="Sync with Google Sheets" title="Sync with Google Sheets">
            <span class="icon-spin" id="sync-icon">${icon('refresh', 18)}</span>
          </button>
          <button class="btn btn-icon" id="settings-button" type="button" aria-label="Settings" title="Settings">
            ${icon('settings', 19)}
          </button>
        </div>
      </header>
      <main id="content"></main>
      <dialog id="settings-dialog" aria-label="Settings"></dialog>
      <div id="toast-root"></div>
    </div>
  `
}

function updateHeader() {
  const subtitle = document.querySelector('#brand-subtitle')
  if (subtitle) subtitle.textContent = 'current cycle'

  const syncing = state.sync.status === 'syncing'
  const syncButton = document.querySelector('#sync-button')
  if (syncButton) {
    syncButton.disabled = syncing
    syncButton.querySelector('.icon-spin')?.classList.toggle('spinning', syncing)
  }

  const themeButton = document.querySelector('#theme-button')
  if (themeButton) {
    const label = resolvedTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    themeButton.setAttribute('aria-label', label)
    themeButton.setAttribute('title', label)
    themeButton.innerHTML = icon(resolvedTheme() === 'dark' ? 'sun' : 'moon', 18)
  }
}

/* ------------------------------------------------------------------ sync */

function freshSheetUrl() {
  const url = new URL(SHEET_CSV_URL)
  url.searchParams.set('t', String(Date.now()))
  return url.toString()
}

async function syncSheet(manual = false) {
  if (state.sync.inFlight) return

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    state.sync.status = 'offline'
    updateHeader()
    if (state.readings.length === 0) renderContent()
    if (manual) showToast('Offline: could not sync', 3600, 'error')
    return
  }

  state.sync.inFlight = true
  state.sync.status = 'syncing'
  state.sync.error = null
  updateHeader()
  if (state.readings.length === 0) renderContent()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(freshSheetUrl(), {
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!response.ok) throw new Error(`Google Sheets responded ${response.status}`)
    const csv = await response.text()
    const parsed = parseReadingsCsv(csv)
    if (parsed.readings.length === 0) throw new Error('The sheet has no readings')

    state.readings = parsed.readings
    state.sync.status = 'ok'
    state.sync.remoteCount = parsed.readings.length
    state.sync.lastAt = nowIso()

    if (manual) showToast(`Sheet updated: ${parsed.readings.length} readings`)
  } catch (error) {
    const offlineNow = typeof navigator !== 'undefined' && !navigator.onLine
    state.sync.status = offlineNow ? 'offline' : 'error'
    const message = error instanceof Error ? error.message : ''
    state.sync.error = offlineNow
      ? 'Offline: no readings'
      : /fetch|network/i.test(message)
        ? 'Could not reach Google Sheets'
        : message || 'Could not read the sheet'
    if (manual) showToast(state.sync.error, 4200, 'error')
  } finally {
    state.sync.inFlight = false
    updateHeader()
    renderContent()
  }
}

/* ------------------------------------------------------------------ views */

function emptyHtml() {
  const syncing = state.sync.status === 'syncing'
  let message
  if (syncing) {
    message = 'Downloading the Google Sheet…'
  } else if (state.sync.status === 'offline') {
    message =
      'Offline: no readings. Connect to download the sheet; the app reads it on every visit.'
  } else if (state.sync.status === 'error') {
    message = `Could not read the sheet: ${escapeHtml(state.sync.error ?? 'unknown error')}`
  } else {
    message =
      'The app reads the published Google Sheet on every visit. It is a plain website: nothing is stored on this device.'
  }

  const danger = state.sync.status === 'error'
  return `
    <section class="card flat" aria-labelledby="empty-title">
      <div class="stack-sm">
        <h2 class="card-title" id="empty-title">No readings yet</h2>
        <p class="small ${danger ? 'text-danger' : 'muted'}" aria-live="polite">${message}</p>
        <div class="row row-wrap">
          <button class="btn btn-sm btn-primary" type="button" id="empty-sync" ${syncing ? 'disabled' : ''}>
            ${syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>
    </section>
  `
}

function cycleCardHtml(analytics) {
  const { cycle, projection, billableM3 } = analytics
  const exact = projection?.currentExactM3 ?? 0
  const currentPct = Math.min(100, (Math.max(0, Math.min(60, billableM3)) / 60) * 100)
  const projectedM3 = projection?.projectedBillableM3 ?? billableM3
  const projectedPct = Math.min(100, (Math.max(0, Math.min(60, projectedM3)) / 60) * 100)
  const currentBlock = billableM3 > 30 ? 3 : billableM3 > 15 ? 2 : 1
  const toThirty = billableM3 <= 30 ? 30 - billableM3 : null
  const ticks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
  const progressValue = Math.max(0, Math.min(60, billableM3))

  if (cycle.baseValue == null) {
    return `
      <section class="card cycle-card" aria-labelledby="cycle-title">
        <div class="card-header"><div><h2 class="card-title" id="cycle-title">Current cycle</h2></div></div>
        <p class="small muted">
          No base for this cycle yet. Add a reading; the base is the last reading before the 20th.
        </p>
      </section>
    `
  }

  const previousAverage =
    analytics.previousCycleAverageM3PerDay == null
      ? ''
      : `<div class="tiny muted">Previous cycle <span class="nowrap">≈ ${formatM3(analytics.previousCycleAverageM3PerDay, 2)} m³/day</span></div>`

  const missingToday = analytics.hasReadingToday
    ? ''
    : '<div class="tiny text-warn">MISSING today&rsquo;s reading</div>'

  const ivaNote = analytics.currentBill.crossesIvaThreshold
    ? '<p class="tiny text-warn">You passed 30 m³: 13% IVA applies to the whole aqueduct.</p>'
    : toThirty != null && toThirty <= 3
      ? `<p class="tiny muted">You are ${formatM3(toThirty, 0)} m³ away from 30 (IVA).</p>`
      : ''

  const gapNote = analytics.gaps.missingYesterday
    ? '<p class="tiny text-warn">No reading from yesterday. The daily series normalizes the gap by hours.</p>'
    : analytics.gaps.hoursSinceLast != null && analytics.gaps.hoursSinceLast > 36
      ? `<p class="tiny text-warn">Last reading ${formatNumber(analytics.gaps.hoursSinceLast, 0)} h ago.</p>`
      : ''

  const waste = projection?.waste ?? null
  const wasteMetrics = waste
    ? `
      <div class="metric-separator" aria-hidden="true"></div>
      <div class="metric">
        <div class="metric-label">House 1 target</div>
        <div class="metric-value numeric">≈ ${formatM3(waste.baselineCycleM3, 1)} m³</div>
        <div class="tiny muted">
          ${formatM3(waste.baselineDailyM3, 3)} m³/day · ≈ ${formatMoney(waste.baselineBill.displayTotal)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">House 2 leak</div>
        <div class="metric-value numeric">${formatM3(waste.leakDailyM3, 3)} m³/day</div>
        <div class="tiny muted">
          ${formatNumber(HOUSE2_LEAK_LPH, 0)} L/h · ≈ ${formatM3(waste.leakCycleM3, 1)} m³ per cycle
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Est. waste</div>
        <div class="metric-value numeric">≈ ${formatM3(waste.projectedWasteM3, 1)} m³</div>
        <div class="tiny text-danger">
          +${formatMoney(waste.projectedWasteColon)} extra · so far ${formatM3(waste.excessSoFarM3, 2)} m³
        </div>
      </div>
    `
    : ''

  return `
    <section class="card cycle-card" aria-labelledby="cycle-title">
      <div class="card-header">
        <div>
          <h2 class="card-title" id="cycle-title">Current cycle</h2>
          <p class="card-subtitle">${escapeHtml(cycle.label)}</p>
        </div>
      </div>

      <div class="cycle-numbers">
        <div class="metric">
          <div class="metric-label">Usage</div>
          <div class="metric-value numeric">${formatM3(exact)} m³</div>
          <div class="tiny muted">≈ ${formatM3(projectedM3, 2)} m³ at cutoff</div>
        </div>
        <div class="metric">
          <div class="metric-label">Last reading</div>
          <div class="metric-value numeric">
            ${analytics.lastReading ? formatM3(analytics.lastReading.value) : '—'} m³
          </div>
          ${previousAverage}
          ${missingToday}
        </div>
        <div class="metric">
          <div class="metric-label">Est. bill</div>
          <div class="metric-value numeric">≈ ${formatMoney(analytics.currentBill.displayTotal)}</div>
          <div class="tiny muted">Estimate, not the receipt</div>
        </div>
        ${wasteMetrics}
      </div>

      <div class="blocks" role="group" aria-label="Billing blocks">
        <div
          class="block-track"
          role="progressbar"
          aria-label="Billable usage this cycle"
          aria-valuemin="0"
          aria-valuemax="60"
          aria-valuenow="${progressValue}"
        >
          <span class="block-zone zone-1"></span>
          <span class="block-zone zone-2"></span>
          <span class="block-zone zone-3"></span>
          <span class="block-fill fill-b${currentBlock}" style="width:${currentPct}%"></span>
          ${ticks.map((tick) => `<span class="block-tick" style="left:${(tick / 60) * 100}%"></span>`).join('')}
          <span class="block-cut" style="left:25%"></span>
          <span class="block-cut" style="left:50%"></span>
          ${projection && cycle.open ? `<span class="block-projection" style="left:${projectedPct}%"></span>` : ''}
          <span class="block-now" style="left:${currentPct}%"></span>
        </div>
        <div class="block-scale tiny muted" aria-hidden="true">
          ${ticks.map((tick) => `<span>${tick}</span>`).join('')}
        </div>
        <div class="block-legend tiny">
          <span class="legend-block"><i class="block-1"></i>Block 1 0–15</span>
          <span class="legend-block"><i class="block-2"></i>Block 2 15–30</span>
          <span class="legend-block"><i class="block-3"></i>Block 3 30–60</span>
        </div>
      </div>

      ${ivaNote}
      ${gapNote}
    </section>
  `
}

function chartsHtml(analytics, model) {
  const baseMissing = analytics.cycle.baseValue == null
  const usageChip = baseMissing
    ? '<span class="badge badge-warn">no base</span>'
    : `<span class="chip">${formatM3(model.currentSeries.totalM3)} m³ current</span>`
  const billChip = baseMissing
    ? '<span class="badge badge-warn">no base</span>'
    : `<span class="chip">${formatMoney(model.billComparison.current.totalAmount)} current</span>`

  const usageLegend = []
  if (model.previousCycle) {
    usageLegend.push(`<span><i class="legend-bar legend-prev"></i>${escapeHtml(model.previousCycle.id)}</span>`)
  }
  usageLegend.push(`<span><i class="legend-bar legend-current"></i>${escapeHtml(analytics.cycle.id)} current</span>`)
  if (model.hasHigher) {
    usageLegend.push('<span><i class="legend-bar legend-over"></i>above the previous cycle</span>')
  }
  if (model.projection?.waste) {
    usageLegend.push('<span><i class="legend-target"></i>House 1 target</span>')
  }

  const billLegend = []
  if (model.billComparison.previous) {
    billLegend.push(`<span><i class="legend-prev"></i>${escapeHtml(model.billComparison.previous.cycle.id)}</span>`)
  }
  billLegend.push(`<span><i class="legend-current"></i>${escapeHtml(analytics.cycle.id)} current</span>`)
  if (analytics.projection && analytics.cycle.open) {
    billLegend.push('<span><i class="legend-dash"></i>projection</span>')
  }
  if (model.projection?.waste) {
    billLegend.push('<span><i class="legend-target"></i>House 1 target</span>')
  }
  if (model.hasMilestones) {
    billLegend.push('<span><i class="legend-dot"></i>block change</span>')
  }

  return `
    <section class="charts-section" aria-labelledby="charts-title">
      <div class="charts-head"><div><h2 class="section-title" id="charts-title">Charts</h2></div></div>

      <div class="card flat chart-card">
        <div class="card-header">
          <div>
            <div class="card-title">Usage</div>
            <div class="card-subtitle">m³ per cycle day; day 1 = the 20th of each month.</div>
          </div>
          ${usageChip}
        </div>
        ${
          baseMissing
            ? '<p class="small muted">Missing the current cycle base.</p>'
            : !model.hasUsage
              ? '<p class="small muted">No readings to compare.</p>'
              : `<div class="chart-box"><canvas id="consumption-chart"></canvas></div>
                 <div class="chart-legend tiny">${usageLegend.join('')}</div>`
        }
      </div>

      <div class="card flat chart-card">
        <div class="card-header">
          <div>
            <div class="card-title">Billing</div>
            <div class="card-subtitle">estimated ₡ accumulated per cycle day.</div>
          </div>
          ${billChip}
        </div>
        ${
          baseMissing
            ? '<p class="small muted">Missing the current cycle base.</p>'
            : `<div class="chart-box"><canvas id="billing-chart"></canvas></div>
               <div class="chart-legend tiny">${billLegend.join('')}</div>`
        }
      </div>
    </section>
  `
}

function filteredReadings(analytics) {
  const needle = state.search.trim().toLowerCase()
  return [...analytics.readings]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .filter((reading) => {
      if (!needle) return true
      return reading.note.toLowerCase().includes(needle) || String(reading.value).includes(needle)
    })
}

function tableRowsHtml(analytics) {
  const intervalByTo = new Map(analytics.intervals.map((item) => [item.to.id, item]))
  const outlierByAt = new Map(analytics.anomalies.map((anomaly) => [anomaly.at, anomaly]))
  const rows = filteredReadings(analytics)

  if (rows.length === 0) {
    return '<tr><td colspan="7" class="small muted" style="padding:12px 0">No readings match that search.</td></tr>'
  }

  return rows
    .map((reading) => {
      const interval = intervalByTo.get(reading.id) ?? null
      const outlier = outlierByAt.get(reading.at) ?? null
      const mark = outlier
        ? `<span class="outlier-mark" title="Unusual usage: ${formatLiters(outlier.litersPerDay)}/day (${formatNumber(outlier.multiplier, 1)}× the median)">${icon('alert', 15)}</span>`
        : ''
      return `
        <tr${outlier ? ' class="outlier"' : ''}>
          <td class="mark">${mark}</td>
          <td class="date-cell numeric">${formatDayMonth(reading.at)}</td>
          <td class="num numeric">${formatM3(reading.value)}</td>
          <td class="num numeric col-dm3">${interval ? formatM3(interval.deltaM3) : '—'}</td>
          <td class="num numeric col-dl">${interval ? formatNumber(interval.liters, 0) : '—'}</td>
          <td class="num numeric">${
            interval && Number.isFinite(interval.lph) ? formatNumber(interval.lph, 1) : '—'
          }</td>
          <td class="note-cell col-note" title="${escapeHtml(reading.note || 'No note')}">
            ${reading.note ? escapeHtml(reading.note) : '—'}
          </td>
        </tr>
      `
    })
    .join('')
}

function tableHtml(analytics) {
  const rows = filteredReadings(analytics)
  return `
    <section class="card flat table-card" aria-labelledby="readings-title">
      <div class="card-header">
        <div>
          <h2 class="card-title" id="readings-title">Readings</h2>
          <p class="card-subtitle">Raw data, one row per reading. Reading = meter; Δ = difference.</p>
        </div>
        <span class="chip" id="row-count">${rows.length} rows</span>
      </div>

      <input
        class="input search"
        type="search"
        id="reading-search"
        value="${escapeHtml(state.search)}"
        placeholder="Search note or reading…"
        aria-label="Search readings"
      />

      <div class="table-wrap raw-wrap">
        <table class="data raw">
          <thead>
            <tr>
              <th class="mark"></th>
              <th class="date-head">Date</th>
              <th class="num measure-head">Reading m³</th>
              <th class="num col-dm3 dm3-head">Δ m³</th>
              <th class="num col-dl dl-head">Δ L</th>
              <th class="num lph-head">L/h</th>
              <th class="note-head col-note">Note</th>
            </tr>
          </thead>
          <tbody id="readings-body">${tableRowsHtml(analytics)}</tbody>
        </table>
      </div>
    </section>
  `
}

function footerHtml(analytics) {
  return `<p class="tiny muted page-foot">In-memory data · ${analytics.readings.length} readings · cycle ${escapeHtml(analytics.cycle.id)}</p>`
}

function renderContent() {
  const content = document.querySelector('#content')
  if (!content) return

  if (state.readings.length === 0) {
    currentAnalytics = null
    currentModel = null
    content.innerHTML = emptyHtml()
    document.querySelector('#empty-sync')?.addEventListener('click', () => void syncSheet(true))
    return
  }

  const analytics = deriveAnalytics({ readings: state.readings })
  const model = buildChartModel(analytics)
  currentAnalytics = analytics
  currentModel = model

  content.innerHTML =
    cycleCardHtml(analytics) +
    chartsHtml(analytics, model) +
    tableHtml(analytics) +
    footerHtml(analytics)

  document.querySelector('#reading-search')?.addEventListener('input', (event) => {
    state.search = event.target.value
    const body = document.querySelector('#readings-body')
    const count = document.querySelector('#row-count')
    if (body && currentAnalytics) body.innerHTML = tableRowsHtml(currentAnalytics)
    if (count && currentAnalytics) count.textContent = `${filteredReadings(currentAnalytics).length} rows`
  })

  renderCharts(model)
}

/* ------------------------------------------------------------------ settings */

function blockLabel(upTo, index) {
  if (upTo == null) return '61+'
  const previous = index === 0 ? 0 : (ARESEP_TARIFFS_2026_10_23.blocks[index - 1].upTo ?? 0)
  return `${previous + 1}–${upTo}`
}

function settingsHtml(analytics) {
  const tariffs = ARESEP_TARIFFS_2026_10_23
  const cycle = analytics?.cycle ?? null
  const fixedTotal =
    tariffs.fixed.acueducto + tariffs.fixed.alcantarillado + tariffs.fixed.hidrantes + tariffs.fixed.tprh
  const preference = storedTheme()

  const syncLine =
    state.sync.status === 'ok'
      ? `<p class="tiny muted">${state.sync.remoteCount} rows in the sheet${state.sync.lastAt ? ` · ${formatDateTime(state.sync.lastAt)}` : ''}</p>`
      : state.sync.status === 'offline'
        ? '<p class="tiny muted">Offline: no readings to show.</p>'
        : state.sync.status === 'error'
          ? `<p class="tiny text-danger">Could not read the sheet: ${escapeHtml(state.sync.error ?? '')}</p>`
          : ''

  return `
    <div class="dialog-header">
      <h2 class="dialog-title">Settings</h2>
      <button class="btn btn-icon" type="button" data-close aria-label="Close">${icon('x', 18)}</button>
    </div>
    <div class="dialog-body">
      <div class="settings-section">
        <h3 class="settings-heading">Cycle</h3>
        <dl class="settings-list">
          <div><dt>Cutoff day</dt><dd>20 · fixed</dd></div>
          <div><dt>Current cycle</dt><dd>${cycle ? escapeHtml(cycle.id) : '—'}</dd></div>
          <div>
            <dt>Cycle base</dt>
            <dd>${
              cycle && cycle.baseValue != null
                ? `${formatM3(cycle.baseValue)} m³${cycle.baseReadingAt ? `<span class="muted"> · ${formatDateTime(cycle.baseReadingAt)}</span>` : ''}`
                : '—'
            }</dd>
          </div>
          <div>
            <dt>Last reading</dt>
            <dd>${
              analytics?.lastReading
                ? `${formatM3(analytics.lastReading.value)} m³<span class="muted"> · ${formatDateTime(analytics.lastReading.at)}</span>`
                : '—'
            }</dd>
          </div>
        </dl>
        <p class="tiny muted">
          The base is the last reading before the 20th at 00:00. The cycle window advances on its
          own; there is nothing to update by hand.
        </p>
      </div>

      <div class="settings-section">
        <div class="between">
          <h3 class="settings-heading">ARESEP tariffs</h3>
          <span class="badge badge-neutral">read-only</span>
        </div>
        <p class="tiny muted">${escapeHtml(tariffs.source)} · effective ${tariffs.effectiveFrom}</p>
        <div class="table-wrap">
          <table class="data tariff-table">
            <thead><tr><th>Block m³</th><th class="num">₡ per m³</th></tr></thead>
            <tbody>
              ${tariffs.blocks
                .map(
                  (block, index) =>
                    `<tr><td>${blockLabel(block.upTo, index)}</td><td class="num">${formatMoney(combinedRate(block, tariffs.include))}</td></tr>`,
                )
                .join('')}
              <tr><td>Fixed charge</td><td class="num">${formatMoney(fixedTotal)}</td></tr>
            </tbody>
          </table>
        </div>
        <p class="tiny muted">
          IVA ${formatNumber(tariffs.iva.rate * 100, 0)}% on the whole aqueduct when usage exceeds
          ${tariffs.iva.thresholdM3} m³. The bill is an estimate; the real receipt wins.
        </p>
      </div>

      <div class="settings-section">
        <h3 class="settings-heading">Data</h3>
        <p class="small muted">Source: Google Sheets, read-only. The app does not modify the sheet.</p>
        <p class="tiny muted">
          The app downloads the sheet on every visit and does not store a copy on the device. To
          download it again, use the refresh button in the header.
        </p>
        <div class="row row-wrap">
          <button class="btn btn-sm" type="button" data-download ${analytics ? '' : 'disabled'}>
            ${icon('download', 15)} Download CSV
          </button>
        </div>
        ${syncLine}
        <p class="tiny muted">Columns: fecha, medicion, nota. Nothing derived.</p>
      </div>

      <div class="settings-section">
        <h3 class="settings-heading">Theme</h3>
        <div class="row row-wrap">
          <button class="btn btn-sm ${preference === 'auto' ? 'btn-primary' : ''}" type="button" data-theme="auto">Auto</button>
          <button class="btn btn-sm ${preference === 'light' ? 'btn-primary' : ''}" type="button" data-theme="light">Light</button>
          <button class="btn btn-sm ${preference === 'dark' ? 'btn-primary' : ''}" type="button" data-theme="dark">Dark</button>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-heading">About</h3>
        <p class="tiny muted">
          Medidor AYA 0.1.0 · reads the published Google Sheets · no account or token.
        </p>
      </div>
    </div>
  `
}

function openSettings() {
  const dialog = document.querySelector('#settings-dialog')
  if (!dialog) return
  dialog.innerHTML = settingsHtml(currentAnalytics)
  attachSettingsListeners(dialog)
  dialog.showModal()
}

/* ------------------------------------------------------------------ boot */

function attachShellListeners() {
  document.querySelector('#theme-button')?.addEventListener('click', () => cycleTheme())
  document.querySelector('#sync-button')?.addEventListener('click', () => void syncSheet(true))
  document.querySelector('#settings-button')?.addEventListener('click', () => openSettings())
}

function init() {
  applyTheme()
  const root = document.querySelector('#app')
  root.innerHTML = shellHtml()
  updateHeader()
  attachShellListeners()
  renderContent()

  const dialog = document.querySelector('#settings-dialog')
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })

  window.addEventListener('online', () => void syncSheet())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncSheet()
  })

  void syncSheet()
}

function attachSettingsListeners(dialog) {
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close())
  dialog.querySelector('[data-download]')?.addEventListener('click', () => {
    downloadFile('medidor.csv', serializeReadingsCsv(state.readings), 'text/csv;charset=utf-8')
    showToast('CSV downloaded')
  })
  dialog.querySelectorAll('[data-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      setTheme(button.dataset.theme)
      dialog.innerHTML = settingsHtml(currentAnalytics)
      attachSettingsListeners(dialog)
    })
  })
}

init()
