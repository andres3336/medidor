<script lang="ts">
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'

  let {
    tone = 'info',
    icon = 'alert',
    title,
    detail,
    action,
    onaction,
  }: {
    tone?: 'ok' | 'info' | 'warn' | 'danger'
    icon?: IconName
    title: string
    detail?: string
    action?: string
    onaction?: () => void
  } = $props()
</script>

<div class="card {tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'flat'}">
  <div class="row" style="align-items:flex-start">
    <span class="badge badge-{tone}"><Icon name={icon} size={14} /></span>
    <div class="list-main">
      <div class="list-title">{title}</div>
      {#if detail}<div class="list-sub" style="margin-top:3px">{detail}</div>{/if}
      {#if action}
        <button
          class="btn btn-sm btn-ghost"
          style="margin-top:6px;padding-left:0"
          onclick={onaction}
        >
          {action}
          <Icon name="arrowRight" size={15} />
        </button>
      {/if}
    </div>
  </div>
</div>
