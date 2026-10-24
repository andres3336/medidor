<script lang="ts">
  import Icon from './Icon.svelte'
  import { toast } from '../state/toast.svelte'
</script>

{#if toast.message}
  <div class="floating-toast" role="status">
    <Icon name="check" size={16} />
    <span>{toast.message}</span>
  </div>
{/if}
