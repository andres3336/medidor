<script lang="ts">
  import { pwa, promptInstall } from '../pwa.svelte'
  import { installBannerDismissed, dismissInstallBanner } from '../state/ui.svelte'
  import Icon from './Icon.svelte'

  let { compact = false }: { compact?: boolean } = $props()

  const visible = $derived(
    !pwa.installed && !installBannerDismissed.value && (pwa.canInstall || pwa.isIos),
  )
  const iosFlow = $derived(pwa.isIos && !pwa.canInstall)
</script>

{#if visible}
  <div class="banner install">
    <Icon name="install" size={22} />
    <div class="list-main">
      <div class="list-title">Instalar Medidor AYA</div>
      <div class="list-sub">
        {#if iosFlow}
          En Safari: tocá Compartir y elegí “Agregar a pantalla de inicio”. Después abrila desde el
          icono y funciona sin conexión.
        {:else}
          Queda en tu pantalla de inicio y abre sin conexión. Tus lecturas viven en el teléfono.
        {/if}
      </div>
      {#if !compact}
        <div class="row row-wrap" style="margin-top:8px">
          {#if !iosFlow}
            <button class="btn btn-sm btn-primary" onclick={() => void promptInstall()}>
              <Icon name="download" size={16} /> Instalar
            </button>
          {/if}
          <button class="btn btn-sm btn-ghost" onclick={dismissInstallBanner}>Ahora no</button>
        </div>
      {/if}
    </div>
  </div>
{/if}
