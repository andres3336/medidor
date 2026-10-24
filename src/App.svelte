<script lang="ts">
  import { onMount } from 'svelte'
  import { app, initStore } from '$lib/state/store.svelte'
  import { deriveAnalytics } from '$lib/state/derive'
  import { initPwa, pwa } from '$lib/pwa.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import UpdatePrompt from '$lib/components/UpdatePrompt.svelte'
  import SettingsDialog from '$lib/components/SettingsDialog.svelte'
  import { initSheetSync, syncSheetCsv } from '$lib/state/sheetSync.svelte'
  import Medidor from './routes/Medidor.svelte'

  let settingsOpen = $state(false)
  const analytics = $derived(deriveAnalytics(app.state))

  onMount(() => {
    initPwa()
    void initStore().then(() => {
      initSheetSync()
      void syncSheetCsv()
    })
  })
</script>

<a class="skip-link" href="#contenido">Saltar al contenido</a>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="./" aria-label="Medidor AYA, ir al inicio">
      <span class="brand-mark"><Icon name="droplet" size={20} filled /></span>
      <span>
        <h1>Medidor AYA</h1>
        <p>{app.ready ? 'Ciclo actual' : 'cargando…'}</p>
      </span>
    </a>
    <div class="topbar-actions">
      {#if pwa.offline}
        <span class="badge badge-neutral" title="Sin conexión: tus datos están en el teléfono">
          <Icon name="wifiOff" size={13} /> offline
        </span>
      {/if}
      <button
        class="btn btn-icon"
        type="button"
        onclick={() => (settingsOpen = true)}
        aria-label="Configuración"
        title="Configuración"
        disabled={!app.ready}
      >
        <Icon name="settings" size={19} />
      </button>
    </div>
  </header>

  <main id="contenido">
    {#if app.error}
      <div class="card danger" role="alert">
        <strong>Algo falló:</strong>
        {app.error}
      </div>
    {/if}

    {#if !app.ready}
      <div class="card flat" aria-busy="true">
        <p class="small muted">Cargando tus mediciones…</p>
      </div>
    {:else}
      <Medidor />
    {/if}
  </main>

  <SettingsDialog bind:open={settingsOpen} {analytics} />
  <UpdatePrompt />
</div>
