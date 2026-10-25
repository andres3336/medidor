<script lang="ts">
  import { app } from '../lib/state/store.svelte'
  import { deriveAnalytics } from '../lib/state/derive'
  import { sheetSync, syncSheetCsv } from '../lib/state/sheetSync.svelte'
  import CycleProgress from '../lib/components/CycleProgress.svelte'
  import ReadingsTable from '../lib/components/ReadingsTable.svelte'
  import Charts from '../lib/components/Charts.svelte'
  import Toast from '../lib/components/Toast.svelte'

  const analytics = $derived(deriveAnalytics(app.state))
</script>

{#if analytics.readings.length === 0}
  <section class="card flat" aria-labelledby="empty-title">
    <div class="stack-sm">
      <h2 class="card-title" id="empty-title">Todavía no hay mediciones</h2>
      {#if sheetSync.status === 'syncing'}
        <p class="small muted" aria-live="polite">Bajando la hoja de Google Sheets…</p>
      {:else if sheetSync.status === 'offline'}
        <p class="small muted" aria-live="polite">
          Sin conexión y sin datos guardados. Conectate una vez para bajar la hoja; después la app
          funciona sin red con la última copia.
        </p>
      {:else if sheetSync.status === 'error'}
        <p class="small text-danger" aria-live="polite">
          No se pudo leer la hoja: {sheetSync.error}
        </p>
      {:else}
        <p class="small muted" aria-live="polite">
          La app lee la hoja publicada de Google Sheets y la guarda en este dispositivo. Sincronizá
          para bajar las lecturas.
        </p>
      {/if}
      <div class="row row-wrap">
        <button
          class="btn btn-sm btn-primary"
          onclick={() => void syncSheetCsv()}
          disabled={sheetSync.status === 'syncing'}
        >
          {sheetSync.status === 'syncing' ? 'Sincronizando…' : 'Sincronizar hoja'}
        </button>
      </div>
    </div>
  </section>
{:else}
  <CycleProgress {analytics} />
  <Charts {analytics} />
  <ReadingsTable {analytics} />
{/if}

<p class="tiny muted page-foot">
  {#if app.dirty}
    Guardando…
  {:else}
    Guardado local
  {/if}
  · {analytics.readings.length} mediciones · ciclo {analytics.cycle.id}
</p>

<Toast />
