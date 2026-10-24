<script lang="ts">
  import type { Reading } from '../domain/types'
  import { addReading, updateReading } from '../state/store.svelte'
  import { formatLiters, parseDecimalInput } from '../domain/format'
  import { hoursBetween, nowIso } from '../domain/dates'
  import { activeReadings } from '../domain/readings'
  import { app } from '../state/store.svelte'
  import Icon from './Icon.svelte'
  import Modal from './Modal.svelte'

  let {
    open = $bindable(false),
    reading = null,
    onclose,
  }: {
    open?: boolean
    reading?: Reading | null
    onclose: () => void
  } = $props()

  const TAGS = [
    'diaria',
    'extra',
    'incidente',
    'ajuste',
    'llave-medidor',
    'llave-alfonso',
    'llave-ducha',
    'casa1',
    'casa2',
  ]

  let at = $state('')
  let value = $state('')
  let note = $state('')
  let tags = $state<string[]>([])
  let flag = $state(false)
  let error = $state<string | null>(null)

  function reset() {
    if (reading) {
      at = reading.at.slice(0, 16)
      value = String(reading.value)
      note = reading.note
      tags = [...reading.tags]
      flag = reading.flag
    } else {
      at = nowIso().slice(0, 16)
      value = ''
      note = ''
      tags = ['diaria']
      flag = false
    }
    error = null
  }

  $effect(() => {
    if (open) reset()
  })

  const preview = $derived.by(() => {
    const parsed = parseDecimalInput(value)
    if (parsed == null || !at) return null
    const iso = `${at}:00-06:00`
    const previous = activeReadings(app.state.readings)
      .filter((item) => item.id !== reading?.id && Date.parse(item.at) < Date.parse(iso))
      .at(-1)
    if (!previous) return null
    const hours = hoursBetween(previous.at, iso)
    const liters = (parsed - previous.value) * 1000
    return { liters, lph: hours > 0 ? liters / hours : null, hours }
  })

  function toggleTag(tag: string) {
    tags = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]
  }

  function save(event: SubmitEvent) {
    event.preventDefault()
    error = null
    const parsed = parseDecimalInput(value)
    if (parsed == null || parsed < 0) {
      error = 'Escribí una medición válida (por ejemplo 103.077).'
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) {
      error = 'Elegí una fecha y hora válidas.'
      return
    }
    const iso = `${at}:00-06:00`
    if (Number.isNaN(Date.parse(iso))) {
      error = 'La fecha no es válida.'
      return
    }

    if (reading) {
      updateReading(reading.id, {
        at: iso,
        value: parsed,
        note: note.trim(),
        tags,
        flag,
      })
    } else {
      addReading({ at: iso, value: parsed, note: note.trim(), tags, flag })
    }
    open = false
    onclose()
  }
</script>

<Modal {open} title={reading ? 'Editar lectura' : 'Agregar lectura'} {onclose}>
  <form onsubmit={save} class="stack">
    <div class="grid-2">
      <label class="field">
        <span class="label">Fecha y hora</span>
        <input class="input" type="datetime-local" bind:value={at} required />
      </label>
      <label class="field">
        <span class="label">Medición (m³)</span>
        <input
          class="input numeric"
          type="text"
          inputmode="decimal"
          bind:value
          placeholder="103.077"
          autocomplete="off"
          required
        />
      </label>
    </div>

    {#if preview}
      <p class="small muted">
        Versus la lectura anterior:
        <strong class={preview.liters < 0 ? 'text-danger' : ''}
          >{formatLiters(preview.liters)}</strong
        >
        {#if preview.lph != null}
          en {preview.hours.toFixed(1)} h ({preview.lph.toFixed(1)} L/h)
        {/if}
      </p>
    {/if}

    <label class="field">
      <span class="label">Nota (opcional)</span>
      <textarea
        class="textarea"
        bind:value={note}
        placeholder="Ej. se lavó en casa2, llave-ducha abierta, no hubo agua…"></textarea>
    </label>

    <div>
      <span class="label">Etiquetas</span>
      <div class="row row-wrap" style="margin-top:6px">
        {#each TAGS as tag (tag)}
          <button
            type="button"
            class="chip"
            style={tags.includes(tag)
              ? 'border-color:var(--accent);color:var(--accent);background:var(--accent-soft)'
              : ''}
            aria-pressed={tags.includes(tag)}
            onclick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        {/each}
      </div>
    </div>

    <label class="check">
      <input type="checkbox" bind:checked={flag} />
      <Icon name="star" size={16} />
      Marcar para revisar
    </label>

    {#if error}
      <p class="small text-danger" role="alert">{error}</p>
    {/if}

    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" onclick={onclose}>Cancelar</button>
      <button type="submit" class="btn btn-primary">
        <Icon name="check" size={17} />
        {reading ? 'Guardar cambios' : 'Agregar lectura'}
      </button>
    </div>
  </form>
</Modal>
