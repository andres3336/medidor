<script lang="ts">
  import type { GapStatus } from '../domain/gaps'
  import { alertDetail, alertTitle } from '../domain/gaps'
  import { formatDayMonth, startOfDay } from '../domain/dates'
  import { acknowledgeGaps } from '../state/store.svelte'
  import Icon from './Icon.svelte'
  import Modal from './Modal.svelte'

  let {
    open = $bindable(false),
    gaps,
    onadd,
  }: { open?: boolean; gaps: GapStatus; onadd: () => void } = $props()

  function acknowledge() {
    acknowledgeGaps(gaps.unacknowledged)
    open = false
  }

  function addNow() {
    open = false
    onadd()
  }
</script>

<Modal {open} title={alertTitle(gaps)} onclose={() => {}} dismissible={false} role="alertdialog">
  <div class="stack">
    <div class="row" style="align-items:flex-start">
      <Icon name="alert" size={22} />
      <div>
        <p class="small">{alertDetail(gaps)}</p>
        <p class="tiny muted" style="margin-top:4px">
          Sin lectura diaria el radar pierde precisión y la factura se vuelve una adivinanza.
        </p>
      </div>
    </div>

    <div class="row row-wrap">
      {#each gaps.unacknowledged as day (day)}
        <span class="chip">{formatDayMonth(startOfDay(day))}</span>
      {/each}
    </div>

    <div class="modal-actions">
      <button class="btn btn-ghost" onclick={acknowledge}>Ya revisé, continuar</button>
      <button class="btn btn-primary" onclick={addNow}>
        <Icon name="plus" size={17} /> Agregar lectura ahora
      </button>
    </div>
  </div>
</Modal>
