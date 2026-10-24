<script lang="ts">
  import type { FlowStats, LeakSignal } from '../domain/types'
  import { formatDateTime } from '../domain/dates'
  import { formatLph, formatM3, formatMoney } from '../domain/format'
  import { leakSignalText } from '../domain/notes'
  import { go } from '../router.svelte'
  import Icon from './Icon.svelte'

  let { flow, leaks }: { flow: FlowStats; leaks: LeakSignal[] } = $props()

  const tone = $derived(
    flow.severity === 'danger' ? 'danger' : flow.severity === 'warn' ? 'warn' : 'ok',
  )
  const top = $derived(
    [...leaks].sort((a, b) => b.unexplainedLiters - a.unexplainedLiters).slice(0, 3),
  )
</script>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Flujo y fugas</div>
      <div class="card-subtitle">Flujo continuo sospechoso, no una fuga confirmada.</div>
    </div>
    <span class="badge badge-{tone}">
      {flow.severity === 'ok' ? 'normal' : flow.severity === 'warn' ? 'ojo' : 'raro'}
    </span>
  </div>

  <div class="grid-3">
    <div class="metric">
      <div class="metric-label">Basal</div>
      <div class="metric-value small-value">{formatLph(flow.basalLph)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Mínimo</div>
      <div class="metric-value small-value">{formatLph(flow.minPositiveLph)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Nocturno</div>
      <div class="metric-value small-value">
        {flow.nocturnalLph == null ? '—' : formatLph(flow.nocturnalLph)}
      </div>
    </div>
  </div>

  {#if flow.basalLph > 0}
    <p class="small" style="margin-top:12px">
      Si sigue igual: ≈ {formatM3(flow.monthlyLossM3, 2)} m³/mes ≈
      <strong>{formatMoney(flow.monthlyCost)}/mes</strong>.
      <span class="muted">Con {flow.sampleSize} intervalos positivos.</span>
    </p>
  {/if}

  {#if top.length > 0}
    <div class="list" style="margin-top:10px">
      {#each top as signal (signal.at)}
        <div class="list-item">
          <span class="badge badge-{signal.severity === 'danger' ? 'danger' : 'warn'}">
            <Icon name="droplet" size={13} />
          </span>
          <div class="list-main">
            <div class="list-title small">{leakSignalText(signal)}</div>
            <div class="list-sub">
              {formatDateTime(signal.at)} · {formatLph(signal.lph)} no explicados
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <button
    class="btn btn-sm btn-ghost"
    style="margin-top:8px;padding-left:0"
    onclick={() => go('analisis')}
  >
    Ver análisis completo <Icon name="arrowRight" size={15} />
  </button>
</div>
