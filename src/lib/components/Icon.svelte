<script lang="ts">
  import { ICON_PATHS, type IconName } from './icons'

  let {
    name,
    size = 20,
    strokeWidth = 1.8,
    filled = false,
  }: { name: IconName; size?: number; strokeWidth?: number; filled?: boolean } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each ICON_PATHS[name] as d, index (index)}
    <path {d} />
  {/each}
</svg>
