<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { Dialog } from 'melt/builders'
  import Icon from './Icon.svelte'

  let {
    open = $bindable(false),
    title,
    children,
    footer,
  }: {
    open?: boolean
    title: string
    children: Snippet
    footer?: Snippet
  } = $props()

  let mounted = $state(false)

  const dialog = new Dialog({
    open: false,
    onOpenChange: (value) => {
      open = value
    },
  })

  $effect(() => {
    if (!mounted) return
    if (open !== dialog.open) dialog.open = open
  })

  onMount(() => {
    mounted = true
  })

  function close() {
    dialog.open = false
  }
</script>

<dialog {...dialog.content} aria-label={title}>
  <div class="dialog-header">
    <h2 class="dialog-title">{title}</h2>
    <button class="btn btn-icon" type="button" onclick={close} aria-label="Cerrar">
      <Icon name="x" size={18} />
    </button>
  </div>
  <div class="dialog-body">
    {@render children()}
  </div>
  {#if footer}
    <div class="dialog-footer">{@render footer()}</div>
  {/if}
</dialog>
