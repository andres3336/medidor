<script lang="ts">
  import { exportCsv } from '../state/store.svelte'
  import { sheetSync, syncSheetCsv } from '../state/sheetSync.svelte'
  import { showToast } from '../state/toast.svelte'
  import { downloadFile } from '../download'
  import { theme, setTheme } from '../theme.svelte'
  import { ARESEP_TARIFFS_2026_10_23, combinedRate } from '../domain/tariffs'
  import { formatDateTime } from '../domain/dates'
  import { formatM3, formatMoney, formatNumber } from '../domain/format'
  import type { Analytics } from '../state/derive'
  import Dialog from './Dialog.svelte'
  import Icon from './Icon.svelte'

  let {
    open = $bindable(false),
    analytics,
  }: {
    open?: boolean
    analytics: Analytics
  } = $props()

  const tariffs = ARESEP_TARIFFS_2026_10_23
  const cycle = $derived(analytics.cycle)
  const fixedTotal = $derived(
    tariffs.fixed.acueducto +
      tariffs.fixed.alcantarillado +
      tariffs.fixed.hidrantes +
      tariffs.fixed.tprh,
  )

  function blockLabel(upTo: number | null, index: number): string {
    if (upTo == null) return '61+'
    const previous = index === 0 ? 0 : (tariffs.blocks[index - 1].upTo ?? 0)
    return `${previous + 1}–${upTo}`
  }

  function download() {
    downloadFile('medidor.csv', exportCsv(), 'text/csv;charset=utf-8')
    showToast('CSV descargado')
  }
</script>

<Dialog bind:open title="Configuración">
  <div class="settings-section">
    <h3 class="settings-heading">Ciclo</h3>
    <dl class="settings-list">
      <div>
        <dt>Día de corte</dt>
        <dd>20 · fijo</dd>
      </div>
      <div>
        <dt>Ciclo actual</dt>
        <dd>{cycle.id}</dd>
      </div>
      <div>
        <dt>Base del ciclo</dt>
        <dd>
          {#if cycle.baseValue == null}
            —
          {:else}
            {formatM3(cycle.baseValue)} m³
            {#if cycle.baseReadingAt}<span class="muted">
                · {formatDateTime(cycle.baseReadingAt)}</span
              >{/if}
          {/if}
        </dd>
      </div>
      <div>
        <dt>Última medición</dt>
        <dd>
          {#if analytics.lastReading}
            {formatM3(analytics.lastReading.value)} m³
            <span class="muted"> · {formatDateTime(analytics.lastReading.at)}</span>
          {:else}
            —
          {/if}
        </dd>
      </div>
    </dl>
    <p class="tiny muted">
      La base es la última medición anterior al día 20 a las 00:00. La ventana del ciclo avanza
      sola; no hay nada que actualizar a mano.
    </p>
  </div>

  <div class="settings-section">
    <div class="between">
      <h3 class="settings-heading">Tarifas ARESEP</h3>
      <span class="badge badge-neutral">solo lectura</span>
    </div>
    <p class="tiny muted">
      {tariffs.source} · vigentes {tariffs.effectiveFrom}
    </p>
    <div class="table-wrap">
      <table class="data tariff-table">
        <thead>
          <tr>
            <th>Bloque m³</th>
            <th class="num">₡ por m³</th>
          </tr>
        </thead>
        <tbody>
          {#each tariffs.blocks as block, index (block.upTo ?? 'last')}
            <tr>
              <td>{blockLabel(block.upTo, index)}</td>
              <td class="num">{formatMoney(combinedRate(block, tariffs.include))}</td>
            </tr>
          {/each}
          <tr>
            <td>Cargo fijo</td>
            <td class="num">{formatMoney(fixedTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="tiny muted">
      IVA {formatNumber(tariffs.iva.rate * 100, 0)}% sobre todo el acueducto si el consumo supera
      {tariffs.iva.thresholdM3} m³. La factura es una estimación; el recibo real manda.
    </p>
  </div>

  <div class="settings-section">
    <h3 class="settings-heading">Datos</h3>
    <p class="small muted">Fuente: Google Sheets, solo lectura. La app no modifica la hoja.</p>
    <p class="tiny muted">La copia de la hoja vive en este dispositivo y se usa sin red.</p>
    <div class="row row-wrap">
      <button
        class="btn btn-sm"
        onclick={() => void syncSheetCsv()}
        disabled={sheetSync.status === 'syncing'}
      >
        <Icon name="refresh" size={15} />
        {sheetSync.status === 'syncing' ? 'Sincronizando…' : 'Sincronizar hoja'}
      </button>
      <button class="btn btn-sm" onclick={download} disabled={analytics.readings.length === 0}>
        <Icon name="download" size={15} /> Descargar CSV
      </button>
    </div>
    {#if sheetSync.status === 'ok'}
      <p class="tiny muted">
        {sheetSync.remoteCount} filas en la hoja · {sheetSync.added} nuevas ·
        {sheetSync.updated} actualizadas
        {#if sheetSync.lastAt}· {formatDateTime(sheetSync.lastAt)}{/if}
      </p>
      {#if sheetSync.localOnly > 0}
        <p class="tiny text-warn">
          {sheetSync.localOnly} filas locales no están en la hoja. Actualizala para verlas en todos los
          dispositivos.
        </p>
      {/if}
    {:else if sheetSync.status === 'offline'}
      <p class="tiny muted">Sin conexión: usando la copia local.</p>
    {:else if sheetSync.status === 'error'}
      <p class="tiny text-danger">No se pudo leer la hoja: {sheetSync.error}</p>
    {/if}
    <p class="tiny muted">Columnas: fecha, medicion, nota. Nada derivado.</p>
  </div>

  <div class="settings-section">
    <h3 class="settings-heading">Tema</h3>
    <div class="row row-wrap">
      <button
        class="btn btn-sm"
        class:btn-primary={theme.preference === 'auto'}
        onclick={() => setTheme('auto')}>Automático</button
      >
      <button
        class="btn btn-sm"
        class:btn-primary={theme.preference === 'light'}
        onclick={() => setTheme('light')}>Claro</button
      >
      <button
        class="btn btn-sm"
        class:btn-primary={theme.preference === 'dark'}
        onclick={() => setTheme('dark')}>Oscuro</button
      >
    </div>
  </div>

  <div class="settings-section">
    <h3 class="settings-heading">Acerca de</h3>
    <p class="tiny muted">
      Medidor AYA 0.1.0 · datos locales · sin gist, sin cuenta, sin token. Funciona sin conexión.
    </p>
  </div>
</Dialog>
