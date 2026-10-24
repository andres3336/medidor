<script lang="ts">
  import type { Reading } from '../domain/types'
  import type { Analytics } from '../state/derive'
  import { toggleFlag } from '../state/store.svelte'
  import { formatDateTime, formatDayMonth, formatTime12 } from '../domain/dates'
  import { formatLiters, formatM3, formatNumber } from '../domain/format'
  import Icon from './Icon.svelte'
  import { swipe } from './swipe'

  let { analytics }: { analytics: Analytics } = $props()

  let search = $state('')

  const intervalByTo = $derived(new Map(analytics.intervals.map((item) => [item.to.id, item])))
  const outlierByAt = $derived(new Map(analytics.anomalies.map((anomaly) => [anomaly.at, anomaly])))

  const rows = $derived.by(() => {
    const needle = search.trim().toLowerCase()
    return [...analytics.readings]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .filter((reading) => {
        if (!needle) return true
        return (
          reading.note.toLowerCase().includes(needle) ||
          reading.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
          String(reading.value).includes(needle)
        )
      })
      .map((reading) => ({
        reading,
        interval: intervalByTo.get(reading.id) ?? null,
        outlier: outlierByAt.get(reading.at) ?? null,
      }))
  })

  function keydown(event: KeyboardEvent, reading: Reading) {
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      toggleFlag(reading.id)
    }
  }
</script>

<section class="card flat table-card" aria-labelledby="readings-title">
  <div class="card-header">
    <div>
      <h2 class="card-title" id="readings-title">Mediciones</h2>
      <p class="card-subtitle">
        Datos crudos, una fila por medición. Medición = medidor; Δ = diferencia.
      </p>
    </div>
    <span class="chip">{rows.length} filas</span>
  </div>

  <input
    class="input search"
    type="search"
    bind:value={search}
    placeholder="Buscar nota o medición…"
    aria-label="Buscar mediciones"
  />

  {#if rows.length === 0}
    <p class="small muted" style="margin-top:12px">No hay mediciones con esa búsqueda.</p>
  {:else}
    <div class="table-wrap raw-wrap">
      <table class="data raw">
        <thead>
          <tr>
            <th class="mark"></th>
            <th class="date-head">Fecha</th>
            <th class="num measure-head">Medición m³</th>
            <th class="num col-dm3 dm3-head">Δ m³</th>
            <th class="num col-dl dl-head">Δ L</th>
            <th class="num col-hours hours-head">Horas</th>
            <th class="num lph-head">L/h</th>
            <th class="note-head col-note">Nota</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.reading.id)}
            <tr
              class:flagged={row.reading.flag}
              class:outlier={row.outlier}
              tabindex="0"
              aria-label={`Medición ${formatM3(row.reading.value)} m³, ${formatDateTime(
                row.reading.at,
              )}. F para favorito.`}
              use:swipe={{ onLeft: () => toggleFlag(row.reading.id) }}
              onkeydown={(event) => keydown(event, row.reading)}
            >
              <td class="mark">
                {#if row.outlier}
                  <span
                    class="outlier-mark"
                    title={`Consumo atípico: ${formatLiters(
                      row.outlier.litersPerDay,
                    )}/día (${formatNumber(row.outlier.multiplier, 1)}× la mediana)`}
                  >
                    <Icon name="alert" size={15} />
                  </span>
                {/if}
              </td>
              <td class="date-cell numeric"
                >{formatDayMonth(row.reading.at)} {formatTime12(row.reading.at)}</td
              >
              <td class="num numeric">{formatM3(row.reading.value)}</td>
              <td class="num numeric col-dm3">
                {row.interval ? formatM3(row.interval.deltaM3) : '—'}
              </td>
              <td class="num numeric col-dl">
                {row.interval ? formatNumber(row.interval.liters, 0) : '—'}
              </td>
              <td class="num numeric col-hours">
                {row.interval ? formatNumber(row.interval.hours, 0) : '—'}
              </td>
              <td class="num numeric">
                {row.interval && Number.isFinite(row.interval.lph)
                  ? formatNumber(row.interval.lph, 1)
                  : '—'}
              </td>
              <td class="note-cell col-note" title={row.reading.note || 'Sin nota'}>
                {row.reading.note || '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="tiny muted swipe-hint">Deslizá ← favorito. En teclado: F favorito.</p>
  {/if}
</section>
