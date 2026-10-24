<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  let {
    open = $bindable(false),
    title,
    onclose,
    children,
    actions,
    dismissible = true,
    role = 'dialog',
  }: {
    open: boolean
    title: string
    onclose: () => void
    children: Snippet
    actions?: Snippet
    dismissible?: boolean
    role?: 'dialog' | 'alertdialog'
  } = $props()

  const uid = $props.id()
  const titleId = `modal-title-${uid}`
  let panel: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => {
      const focusable = panel?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, button',
      )
      focusable?.focus()
    })
    return () => {
      document.body.style.overflow = previous
    }
  })

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault()
      onclose()
      return
    }
    if (event.key !== 'Tab' || !panel) return
    const nodes = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => {
      if (dismissible && event.target === event.currentTarget) onclose()
    }}
  >
    <div
      class="modal"
      {role}
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      bind:this={panel}
      onkeydown={handleKey}
    >
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id={titleId}>{title}</h2>
        </div>
        {#if dismissible}
          <button class="btn btn-icon" type="button" onclick={onclose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        {/if}
      </div>
      {@render children()}
      {#if actions}
        <div class="modal-actions">{@render actions()}</div>
      {/if}
    </div>
  </div>
{/if}
