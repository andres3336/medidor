<script lang="ts">
  import { onMount } from 'svelte'
  import { app, initStore, toggleTheme } from '$lib/state/store.svelte'
  import { nav, go } from '$lib/router.svelte'
  import { NAV_ROUTES } from '$lib/router'
  import { initPwa, pwa } from '$lib/pwa.svelte'
  import { theme } from '$lib/theme.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import UpdatePrompt from '$lib/components/UpdatePrompt.svelte'
  import Hoy from './routes/Hoy.svelte'
  import Lecturas from './routes/Lecturas.svelte'
  import Graficas from './routes/Graficas.svelte'
  import Analisis from './routes/Analisis.svelte'
  import Ajustes from './routes/Ajustes.svelte'
  import Instrucciones from './routes/Instrucciones.svelte'

  onMount(() => {
    initPwa()
    void initStore()
  })

  const routeLabel = $derived(
    nav.route === 'instrucciones'
      ? 'Instrucciones'
      : NAV_ROUTES.find((r) => r.id === nav.route)?.label,
  )
</script>

<a class="skip-link" href="#contenido">Saltar al contenido</a>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="#/hoy" aria-label="Medidor AYA, ir a Hoy">
      <span class="brand-mark"><Icon name="droplet" size={20} filled /></span>
      <span>
        <h1>Medidor AYA</h1>
        <p>{routeLabel ?? 'Radar de consumo'} · es-CR</p>
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
        onclick={toggleTheme}
        aria-label="Cambiar tema (actual: {theme.resolved})"
        title="Cambiar tema"
      >
        <Icon name={theme.resolved === 'dark' ? 'sun' : 'moon'} size={19} />
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
        <p class="small muted">Cargando tus lecturas…</p>
      </div>
    {:else if nav.route === 'hoy'}
      <Hoy />
    {:else if nav.route === 'lecturas'}
      <Lecturas />
    {:else if nav.route === 'graficas'}
      <Graficas />
    {:else if nav.route === 'analisis'}
      <Analisis />
    {:else if nav.route === 'ajustes'}
      <Ajustes />
    {:else if nav.route === 'instrucciones'}
      <Instrucciones />
    {/if}
  </main>

  <nav class="bottom-nav" aria-label="Navegación principal">
    {#each NAV_ROUTES as item (item.id)}
      <a
        class="nav-item"
        href="#/{item.id}"
        aria-current={nav.route === item.id ? 'page' : undefined}
        onclick={(event) => {
          event.preventDefault()
          go(item.id)
        }}
      >
        <Icon name={item.icon} size={20} />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <UpdatePrompt />
</div>
