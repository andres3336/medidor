<script lang="ts">
  import type { Baseline, DayPoint } from '../domain/types'
  import { formatDayMonth, startOfDay } from '../domain/dates'
  import { formatLiters, formatMultiplier } from '../domain/format'

  let {
    days,
    baseline,
    outlierAt = [],
  }: { days: DayPoint[]; baseline: Baseline; outlierAt?: string[] } = $props()

  const scale = $derived(
    Math.max(...days.map((day) => day.litersPerDay), baseline.p75 * 1.4, baseline.median * 1.4, 1),
  )

  const bandBottom = $derived((baseline.p25 / scale) * 100)
  const bandHeight = $derived(Math.max(2, ((baseline.p75 - baseline.p25) / scale) * 100))

  function heightFor(value: number): number {
    return Math.max(3, Math.min(100, (value / scale) * 100))
  }

  function tone(day: DayPoint): string {
    if (outlierAt.includes(day.at)) return 'is-danger'
    if (day.litersPerDay > baseline.p75) return 'is-warn'
    return ''
  }
</script>

{#if days.length === 0}
  <p class="small muted">Todavía no hay dos días con lectura para dibujar el radar.</p>
{:else}
  <div class="radar-plot">
    <div
      class="radar-band"
      style="bottom:{bandBottom}%;height:{bandHeight}%"
      title={`Banda normal ${formatLiters(baseline.p25)}–${formatLiters(baseline.p75)}`}
    ></div>
    {#each days as day (day.day)}
      <div class="radar-col">
        <div
          class="radar-bar {tone(day)}"
          style="height:{heightFor(day.litersPerDay)}%"
          title={`${formatDayMonth(startOfDay(day.day))}: ${formatLiters(day.litersPerDay)}/día (${formatMultiplier(
            baseline.median > 0 ? day.litersPerDay / baseline.median : 0,
          )})`}
        ></div>
      </div>
    {/each}
  </div>
  <div class="radar-labels">
    {#each days as day (day.day)}
      <span class="radar-label">{formatDayMonth(startOfDay(day.day)).split(' ')[0]}</span>
    {/each}
  </div>
  <div class="between tiny muted" style="margin-top:8px">
    <span
      >Línea punteada: banda normal {formatLiters(baseline.p25)}–{formatLiters(baseline.p75)}</span
    >
    <span>{formatLiters(baseline.median)}/día</span>
  </div>
{/if}

<style>
  .radar-plot {
    position: relative;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 7px;
    align-items: end;
    height: 96px;
    padding: 2px 0;
  }

  .radar-col {
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    position: relative;
    z-index: 2;
  }

  .radar-bar {
    width: 100%;
    max-width: 32px;
    border-radius: 6px 6px 3px 3px;
    background: linear-gradient(180deg, #4aa8ff, var(--accent));
    transition: height 0.25s ease;
  }

  .radar-bar.is-warn {
    background: linear-gradient(180deg, #ffcf6b, var(--warn));
  }

  .radar-bar.is-danger {
    background: linear-gradient(180deg, #ff9a9a, var(--danger));
  }

  .radar-band {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed color-mix(in srgb, var(--muted) 45%, transparent);
    border-bottom: 1px dashed color-mix(in srgb, var(--muted) 45%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    z-index: 1;
    pointer-events: none;
  }

  .radar-labels {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 7px;
    margin-top: 6px;
  }

  .radar-labels span {
    text-align: center;
  }
</style>
