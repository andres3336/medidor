<script lang="ts">
  import { pwa, reloadForUpdate, dismissUpdate } from '../pwa.svelte'
  import Icon from './Icon.svelte'
</script>

{#if pwa.needRefresh}
  <div class="floating-toast" role="alert">
    <Icon name="refresh" size={18} />
    <span class="spacer">Hay una versión nueva de Medidor.</span>
    <button class="btn btn-sm btn-primary" onclick={() => void reloadForUpdate()}>Actualizar</button
    >
    <button class="btn btn-sm btn-ghost" onclick={dismissUpdate}>Después</button>
  </div>
{/if}
