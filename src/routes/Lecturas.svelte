<script lang="ts">
  import type { Reading } from '$lib/domain/types'
  import {
    app,
    deleteReading,
    exportCsv,
    restoreReading,
    toggleFlag,
  } from '$lib/state/store.svelte'
  import { nav } from '$lib/router.svelte'
  import { deriveAnalytics } from '$lib/state/derive'
  import { copyText, currentSummaryMarkdown, downloadFile } from '$lib/state/summary'
  import { formatDate, formatTime, hoursBetween } from '$lib/domain/dates'
  import { formatLph, formatM3, formatNumber } from '$lib/domain/format'
  import Icon from '$lib/components/Icon.svelte'
  import ReadingForm from '$lib/components/ReadingForm.svelte'

  const analytics = $derived(deriveAnalytics(app.state))

  let search = $state('')
  let cycleFilter = $state<string>('current')
  let onlyFlags = $state(false)
  let onlyOutliers = $state(false)
  let editing = $state<Reading | null>(null)
  let formOpen = $state(false)
  let undoId = $state<string | null>(null)
  let toast = $state<string | null>(null)
  let undoTimer: ReturnType<typeof setTimeout> | null = null

  // Atajo de la PWA: #/lecturas?nueva=1 abre el formulario directo.
  let shortcutHandled = false
  $effect(() => {
    if (!shortcutHandled && nav.query.get('nueva') === '1') {
      shortcutHandled = true
      editing = null
      formOpen = true
    }
  })

  const outlierAts = $derived(new Set(analytics.anomalies.map((anomaly) => anomaly.at)))

  const sorted = $derived.by(() => {
    const active = app.state.readings
      .filter((reading) => !reading.deleted)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const previousById: Record<string, Reading> = {}
    active.forEach((reading, index) => {
      if (index > 0) previousById[reading.id] = active[index - 1]
    })
    return active
      .map((reading) => {
        const previous = previousById[reading.id] ?? null
        const hours = previous ? hoursBetween(previous.at, reading.at) : null
        const liters = previous ? (reading.value - previous.value) * 1000 : null
        return {
          reading,
          previous,
          hours,
          liters,
          lph: hours && hours > 0 && liters != null ? liters / hours : null,
        }
      })
      .reverse()
  })

  const filtered = $derived(
    sorted.filter(({ reading }) => {
      if (cycleFilter === 'current') {
        if (Date.parse(reading.at) < Date.parse(analytics.cycle.startAt)) return false
      } else if (cycleFilter !== 'all') {
        const cycle = app.state.cycles.find((item) => item.startAt === cycleFilter)
        const from = Date.parse(cycleFilter)
        const to = cycle?.endAt ? Date.parse(cycle.endAt) : Number.POSITIVE_INFINITY
        const time = Date.parse(reading.at)
        if (time < from || time >= to) return false
      }
      if (onlyFlags && !reading.flag) return false
      if (onlyOutliers && !outlierAts.has(reading.at)) return false
      if (search.trim()) {
        const needle = search.trim().toLowerCase()
        if (
          !reading.note.toLowerCase().includes(needle) &&
          !reading.tags.some((tag) => tag.includes(needle)) &&
          !String(reading.value).includes(needle)
        ) {
          return false
        }
      }
      return true
    }),
  )

  function startEdit(reading: Reading) {
    editing = reading
    formOpen = true
  }

  function remove(reading: Reading) {
    deleteReading(reading.id)
    undoId = reading.id
    toast = 'Lectura borrada'
    if (undoTimer) clearTimeout(undoTimer)
    undoTimer = setTimeout(() => {
      undoId = null
      toast = null
    }, 5000)
  }

  function undo() {
    if (undoId) restoreReading(undoId)
    undoId = null
    toast = null
    if (undoTimer) clearTimeout(undoTimer)
  }

  function downloadCsv() {
    downloadFile('data.csv', exportCsv(), 'text/csv;charset=utf-8')
  }

  function downloadSummary() {
    downloadFile('resumen.md', currentSummaryMarkdown(), 'text/markdown;charset=utf-8')
  }

  async function copySummary() {
    const ok = await copyText(currentSummaryMarkdown())
    toast = ok ? 'Resumen copiado' : 'No se pudo copiar; descargalo'
    setTimeout(() => (toast = null), 3000)
  }
</script>

<div class="between">
  <div>
    <h2>Ciclo {analytics.cycle.label}</h2>
    <p class="small muted">{filtered.length} lecturas visibles</p>
  </div>
  <button
    class="btn btn-primary btn-sm"
    onclick={() => {
      editing = null
      formOpen = true
    }}
  >
    <Icon name="plus" size={16} /> Agregar
  </button>
</div>

<div class="card flat">
  <div class="stack-sm">
    <input
      class="input"
      type="search"
      bind:value={search}
      placeholder="Buscar nota, tag o medición…"
      aria-label="Buscar lecturas"
    />
    <div class="grid-2">
      <label class="field">
        <span class="label">Ciclo</span>
        <select class="select" bind:value={cycleFilter}>
          <option value="current">Ciclo actual</option>
          <option value="all">Todos</option>
          {#each [...app.state.cycles].sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt)) as cycle (cycle.id)}
            <option value={cycle.startAt}>{cycle.id} · {cycle.label}</option>
          {/each}
        </select>
      </label>
      <div class="stack-sm" style="justify-content:flex-end">
        <label class="check">
          <input type="checkbox" bind:checked={onlyFlags} /> Solo flags
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={onlyOutliers} /> Solo outliers
        </label>
      </div>
    </div>
    <div class="row row-wrap">
      <button class="btn btn-sm" onclick={downloadCsv}>
        <Icon name="download" size={15} /> data.csv
      </button>
      <button class="btn btn-sm" onclick={copySummary}>
        <Icon name="copy" size={15} /> Copiar resumen
      </button>
      <button class="btn btn-sm" onclick={downloadSummary}>
        <Icon name="download" size={15} /> resumen.md
      </button>
    </div>
  </div>
</div>

{#if filtered.length === 0}
  <div class="card flat">
    <p class="small muted">No hay lecturas con esos filtros.</p>
  </div>
{:else}
  <div class="card flat" style="padding:0;overflow:hidden">
    {#each filtered as item (item.reading.id)}
      <article class="reading" class:flagged={item.reading.flag}>
        <div class="r-date">
          <div class="list-title">{formatDate(item.reading.at)}</div>
          <div class="list-sub">
            {formatTime(item.reading.at)}
            {#if item.lph != null}
              · {formatNumber(item.hours ?? 0, 1)} h
            {/if}
          </div>
        </div>
        <div class="r-value numeric">
          <strong>{formatM3(item.reading.value)}</strong>
          <span class="tiny muted">m³</span>
        </div>
        <div class="r-delta numeric">
          {#if item.liters != null}
            <span class={item.liters < 0 ? 'text-danger' : ''}>
              {formatNumber(item.liters, 0)} L
            </span>
            <span class="tiny muted"
              >{#if item.lph != null}{formatLph(item.lph)}{/if}</span
            >
          {:else}
            <span class="tiny muted">base</span>
          {/if}
        </div>
        <div class="r-note">
          <p class="list-sub">{item.reading.note || 'Sin nota'}</p>
          {#if item.reading.tags.length > 0}
            <div class="row row-wrap" style="margin-top:4px;gap:4px">
              {#each item.reading.tags as tag (tag)}
                <span class="chip">{tag}</span>
              {/each}
            </div>
          {/if}
        </div>
        <div class="r-actions">
          <button
            class="btn btn-icon"
            type="button"
            onclick={() => toggleFlag(item.reading.id)}
            aria-label={item.reading.flag ? 'Quitar flag' : 'Marcar flag'}
            aria-pressed={item.reading.flag}
            style={item.reading.flag ? 'color:var(--warn)' : ''}
          >
            <Icon name="star" size={17} filled={item.reading.flag} />
          </button>
          <button
            class="btn btn-icon"
            type="button"
            onclick={() => startEdit(item.reading)}
            aria-label="Editar lectura"
          >
            <Icon name="edit" size={17} />
          </button>
          <button
            class="btn btn-icon"
            type="button"
            onclick={() => remove(item.reading)}
            aria-label="Borrar lectura"
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
      </article>
    {/each}
  </div>
{/if}

{#if toast}
  <div class="floating-toast" role="status">
    <span class="spacer">{toast}</span>
    {#if undoId}
      <button class="btn btn-sm" onclick={undo}>Deshacer</button>
    {/if}
  </div>
{/if}

<ReadingForm
  bind:open={formOpen}
  reading={editing}
  onclose={() => {
    formOpen = false
    editing = null
  }}
/>

<style>
  .reading {
    display: grid;
    gap: 8px 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    grid-template-columns: 1fr auto auto;
    align-items: start;
  }

  .reading:last-child {
    border-bottom: 0;
  }

  .reading.flagged {
    background: color-mix(in srgb, var(--warn) 7%, transparent);
  }

  .r-date {
    grid-column: 1 / 2;
  }

  .r-value {
    grid-column: 2 / 3;
    text-align: right;
    font-size: 1rem;
  }

  .r-delta {
    grid-column: 3 / 4;
    text-align: right;
    display: flex;
    flex-direction: column;
    font-size: 0.82rem;
  }

  .r-note {
    grid-column: 1 / 4;
  }

  .r-actions {
    grid-column: 1 / 4;
    display: flex;
    justify-content: flex-end;
    gap: 2px;
  }

  @media (min-width: 700px) {
    .reading {
      grid-template-columns: 1.25fr 0.8fr 0.8fr 2.4fr auto;
      align-items: center;
    }

    .r-date {
      grid-column: auto;
    }

    .r-value {
      grid-column: auto;
      text-align: left;
    }

    .r-delta {
      grid-column: auto;
      text-align: left;
    }

    .r-note {
      grid-column: auto;
      min-width: 0;
    }

    .r-actions {
      grid-column: auto;
    }

    .r-note .list-sub {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
</style>
