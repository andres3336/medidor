<script lang="ts">
  import Icon from './Icon.svelte'
  import { toast } from '../state/toast.svelte'
</script>

{#if toast.message}
  <div class="floating-toast" class:is-error={toast.kind === 'error'} role="status">
    <Icon name={toast.kind === 'error' ? 'alert' : 'check'} size={16} />
    <span>{toast.message}</span>
  </div>
{/if}
