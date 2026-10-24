<script lang="ts">
  import { app } from '../lib/state/store.svelte'
  import { deriveAnalytics } from '../lib/state/derive'
  import CycleProgress from '../lib/components/CycleProgress.svelte'
  import ReadingsTable from '../lib/components/ReadingsTable.svelte'
  import Charts from '../lib/components/Charts.svelte'
  import Toast from '../lib/components/Toast.svelte'

  const analytics = $derived(deriveAnalytics(app.state))
</script>

<CycleProgress {analytics} />
<Charts {analytics} />
<ReadingsTable {analytics} />

<p class="tiny muted page-foot">
  {#if app.dirty}
    Guardando…
  {:else}
    Guardado local
  {/if}
  · {analytics.readings.length} mediciones · ciclo {analytics.cycle.id}
</p>

<Toast />
