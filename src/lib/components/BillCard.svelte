<script lang="ts">
  import type { Bill, Projection } from '../domain/types'
  import { formatM3, formatMoney } from '../domain/format'
  import { COMPONENT_SHORT, TARIFF_COMPONENTS } from '../domain/tariffs'
  import Icon from './Icon.svelte'

  let { projection, currentBill }: { projection: Projection | null; currentBill: Bill } = $props()

  let open = $state(false)
</script>

<div class="card flat">
  <button
    class="card-header"
    style="width:100%;background:none;border:0;padding:0;text-align:left;cursor:pointer"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <div>
      <div class="card-title">Factura estimada</div>
      <div class="card-subtitle">
        Referencia, no el recibo real. A hoy: {formatMoney(currentBill.displayTotal)}
      </div>
    </div>
    <span class="badge badge-info">
      {#if projection}
        al cierre ≈ {formatMoney(projection.scenarios[0].bill.displayTotal)}
      {:else}
        {formatMoney(currentBill.displayTotal)}
      {/if}
      <Icon name="chevronDown" size={14} />
    </span>
  </button>

  {#if open}
    <div class="stack" style="margin-top:14px">
      {#if projection}
        <div class="grid-3">
          <div class="metric">
            <div class="metric-label">A hoy</div>
            <div class="metric-value small-value">{formatMoney(currentBill.displayTotal)}</div>
            <div class="tiny muted">{currentBill.billableM3} m³</div>
          </div>
          <div class="metric">
            <div class="metric-label">Esperada</div>
            <div class="metric-value small-value">
              {formatMoney(projection.scenarios[0].bill.displayTotal)}
            </div>
            <div class="tiny muted">{projection.scenarios[0].billableM3} m³</div>
          </div>
          <div class="metric">
            <div class="metric-label">Peor</div>
            <div class="metric-value small-value">
              {formatMoney(projection.worst.bill.displayTotal)}
            </div>
            <div class="tiny muted">{projection.worst.billableM3} m³</div>
          </div>
        </div>

        <p class="tiny muted">
          Proyección con {formatM3(projection.remainingDays, 0)} días restantes. El “peor” usa el día
          más alto del ciclo; es un presupuesto conservador.
        </p>
      {/if}

      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Componente</th>
              <th class="num">A hoy</th>
            </tr>
          </thead>
          <tbody>
            {#each TARIFF_COMPONENTS as component (component)}
              <tr>
                <td>{COMPONENT_SHORT[component]}</td>
                <td class="num">{formatMoney(currentBill.components[component])}</td>
              </tr>
            {/each}
            <tr>
              <td>IVA</td>
              <td class="num">{formatMoney(currentBill.iva)}</td>
            </tr>
            <tr>
              <td><strong>Total</strong></td>
              <td class="num"><strong>{formatMoney(currentBill.displayTotal)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      {#if projection?.m3ToNextThreshold.thirty != null && projection.m3ToNextThreshold.thirty <= 5}
        <div class="card warn flat">
          <div class="row">
            <Icon name="alert" size={18} />
            <div class="small">
              Estás a {formatM3(projection.m3ToNextThreshold.thirty, 0)} m³ de los 30. Si cruzás ese umbral,
              el IVA del 13% se aplica a <strong>todo el acueducto</strong>: unos ₡5,215 más.
            </div>
          </div>
        </div>
      {/if}

      <p class="tiny muted">Estimación; el recibo real de AYA manda.</p>
    </div>
  {/if}
</div>
