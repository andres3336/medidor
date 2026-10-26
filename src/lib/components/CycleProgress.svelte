<script lang="ts">
  import { Progress } from 'melt/builders'
  import type { Analytics } from '../state/derive'
  import { formatM3, formatMoney, formatNumber } from '../domain/format'

  let { analytics }: { analytics: Analytics } = $props()

  const cycle = $derived(analytics.cycle)
  const projection = $derived(analytics.projection)
  const billable = $derived(analytics.billableM3)
  const exact = $derived(projection?.currentExactM3 ?? 0)
  const currentPct = $derived(Math.min(100, (Math.max(0, Math.min(60, billable)) / 60) * 100))
  const projectedM3 = $derived(projection?.projectedBillableM3 ?? billable)
  const projectedPct = $derived(Math.min(100, (Math.max(0, Math.min(60, projectedM3)) / 60) * 100))
  const currentBlock = $derived(billable > 30 ? 3 : billable > 15 ? 2 : 1)
  const toThirty = $derived(billable <= 30 ? 30 - billable : null)
  const averageDelta = $derived(
    analytics.averageM3PerDay != null && analytics.previousCycleAverageM3PerDay != null
      ? analytics.averageM3PerDay - analytics.previousCycleAverageM3PerDay
      : null,
  )
  const ticks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
  const progress = new Progress({
    value: () => Math.max(0, Math.min(60, billable)),
    max: 60,
  })
</script>

<section class="card cycle-card" aria-labelledby="cycle-title">
  <div class="card-header">
    <div>
      <h2 class="card-title" id="cycle-title">Ciclo actual</h2>
    </div>
  </div>

  {#if cycle.baseValue == null}
    <p class="small muted">
      Todavía no hay base para este ciclo. Agregá una medición; la base se toma de la última
      medición anterior al día 20.
    </p>
  {:else}
    <div class="cycle-numbers">
      <div class="metric">
        <div class="metric-label">Consumo</div>
        <div class="metric-value numeric">{formatM3(exact)} m³</div>
        <div class="tiny muted">≈ {projectedM3} m³ al cierre</div>
      </div>
      <div class="metric">
        <div class="metric-label">Lectura ant</div>
        <div class="metric-value numeric">
          {analytics.lastReading ? formatM3(analytics.lastReading.value) : '—'} m³
        </div>
        {#if analytics.previousCycleAverageM3PerDay != null}
          <div class="tiny muted">
            Ciclo anterior
            <span class="nowrap"
              >≈ {formatM3(analytics.previousCycleAverageM3PerDay, 2)} m³/día</span
            >
          </div>
        {/if}
        {#if !analytics.hasReadingToday}
          <div class="tiny text-warn">FALTA la de hoy</div>
        {/if}
      </div>
      <div class="metric">
        <div class="metric-label">Factura aprox.</div>
        <div class="metric-value numeric">≈ {formatMoney(analytics.currentBill.displayTotal)}</div>
        <div class="tiny muted">Estimación, no el recibo</div>
      </div>
      <div class="metric">
        <div class="metric-label">Promedio</div>
        <div class="metric-value numeric">
          {analytics.averageM3PerDay == null
            ? '—'
            : `${formatM3(analytics.averageM3PerDay, 2)} m³/día`}
        </div>
        {#if analytics.previousCycleAverageM3PerDay == null}
          <div class="tiny muted">Sin ciclo anterior para comparar.</div>
        {:else}
          <div class="tiny muted">
            Anterior {formatM3(analytics.previousCycleAverageM3PerDay, 2)}
            {#if averageDelta != null}
              ·
              <span class={averageDelta > 0 ? 'text-warn' : averageDelta < 0 ? 'text-ok' : 'muted'}>
                {averageDelta > 0 ? '+' : ''}{formatM3(averageDelta, 2)} m³/día
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="blocks" aria-label="Bloques de facturación">
      <div class="block-track" {...progress.root}>
        <span class="block-zone zone-1"></span>
        <span class="block-zone zone-2"></span>
        <span class="block-zone zone-3"></span>
        <span class="block-fill fill-b{currentBlock}" style="width:{currentPct}%"></span>
        {#each ticks as tick (tick)}
          <span class="block-tick" style="left:{(tick / 60) * 100}%"></span>
        {/each}
        <span class="block-cut" style="left:25%"></span>
        <span class="block-cut" style="left:50%"></span>
        {#if projection && cycle.open}
          <span class="block-projection" style="left:{projectedPct}%"></span>
        {/if}
        <span class="block-now" style="left:{currentPct}%"></span>
      </div>
      <div class="block-scale tiny muted" aria-hidden="true">
        {#each ticks as tick (tick)}
          <span>{tick}</span>
        {/each}
      </div>
      <div class="block-legend tiny">
        <span class="legend-block"><i class="block-1"></i>Bloque1 0–15</span>
        <span class="legend-block"><i class="block-2"></i>Bloque2 15–30</span>
        <span class="legend-block"><i class="block-3"></i>Bloque3 30–60</span>
      </div>
    </div>

    {#if analytics.currentBill.crossesIvaThreshold}
      <p class="tiny text-warn">Ya pasaste los 30 m³: el IVA del 13% aplica a todo el acueducto.</p>
    {:else if toThirty != null && toThirty <= 3}
      <p class="tiny muted">
        Estás a {formatM3(toThirty, 0)} m³ de los 30 (IVA).
      </p>
    {/if}

    {#if analytics.gaps.missingYesterday}
      <p class="tiny text-warn">
        No hay medición de ayer. La serie diaria normaliza el hueco por horas.
      </p>
    {:else if analytics.gaps.hoursSinceLast != null && analytics.gaps.hoursSinceLast > 36}
      <p class="tiny text-warn">
        Última medición hace {formatNumber(analytics.gaps.hoursSinceLast, 0)} h.
      </p>
    {/if}
  {/if}
</section>
