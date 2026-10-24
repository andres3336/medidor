<script lang="ts">
  import {
    app,
    closeCurrentCycle,
    exportCsv,
    exportJson,
    importCsvText,
    importJsonText,
    resetAll,
    updateCycleBase,
    updateSettings,
  } from '$lib/state/store.svelte'
  import { deriveAnalytics } from '$lib/state/derive'
  import { expectedCycleEnd, lastReadingInCycle } from '$lib/domain/cycles'
  import {
    ARESEP_TARIFFS_2026_10_23,
    COMPONENT_SHORT,
    TARIFF_COMPONENTS,
    defaultTariffs,
  } from '$lib/domain/tariffs'
  import type { Tariffs } from '$lib/domain/types'
  import { formatDateTime, formatDate, nowIso } from '$lib/domain/dates'
  import { formatM3, parseDecimalInput } from '$lib/domain/format'
  import { downloadFile } from '$lib/state/summary'
  import { setTheme, theme } from '$lib/theme.svelte'
  import { pwa } from '$lib/pwa.svelte'
  import { resetInstallBanner } from '$lib/state/ui.svelte'
  import { go } from '$lib/router.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import InstallBanner from '$lib/components/InstallBanner.svelte'

  const analytics = $derived(deriveAnalytics(app.state))
  const cycle = $derived(analytics.cycle)
  const last = $derived(lastReadingInCycle(app.state.readings, cycle))

  // eslint-disable-next-line svelte/prefer-writable-derived -- el usuario edita el campo antes de guardar
  let baseInput = $state('')
  let baseReason = $state('Ajuste manual de la base')
  let toast = $state<string | null>(null)

  $effect(() => {
    baseInput = String(cycle.baseValue)
  })

  let tariffs = $state<Tariffs>(JSON.parse(JSON.stringify(app.state.settings.tariffs)) as Tariffs)
  let ivaPct = $state(Math.round(app.state.settings.tariffs.iva.rate * 100))

  let draft = $state({
    cycleDay: app.state.settings.cycleDay,
    gapWarnHours: app.state.settings.gapWarnHours,
    baselineWindowDays: app.state.settings.baselineWindowDays,
    multiplier: app.state.settings.outlier.multiplier,
    madFactor: app.state.settings.outlier.madFactor,
    flowWarning: app.state.settings.flow.warningLph,
    flowDanger: app.state.settings.flow.dangerLph,
    noteThreshold: app.state.settings.note.unexplainedWarnLiters,
    method: app.state.settings.projection.method,
  })

  let closeOpen = $state(false)
  let closeCut = $state('')
  let closeFinal = $state('')
  let closeBilled = $state('')
  let closeActual = $state('')
  let closeNote = $state('')
  let closeError = $state<string | null>(null)

  let gistId = $state(app.state.settings.gist.id ?? '')
  let gistUrl = $state(app.state.settings.gist.url ?? '')
  let token = $state(
    typeof localStorage === 'undefined' ? '' : (localStorage.getItem('medidor.gist.token') ?? ''),
  )
  let tokenStatus = $state<string | null>(null)

  function notify(message: string) {
    toast = message
    setTimeout(() => (toast = null), 3500)
  }

  function saveBase() {
    const value = parseDecimalInput(baseInput)
    if (value == null || value < 0) {
      notify('La base debe ser un número válido')
      return
    }
    if (last && value > last.value) {
      notify(`La base no puede superar la última lectura (${formatM3(last.value)} m³)`)
      return
    }
    if (
      !window.confirm(
        `¿Cambiar la base de ${formatM3(cycle.baseValue)} a ${formatM3(value)} m³? Queda auditado.`,
      )
    ) {
      return
    }
    updateCycleBase(cycle, value, baseReason.trim() || 'Ajuste manual de la base')
    notify('Base actualizada y auditada')
  }

  function openClose() {
    const suggested = last?.value ?? cycle.baseValue
    closeFinal = String(suggested)
    closeBilled = String(Math.max(0, Math.floor(suggested) - Math.floor(cycle.baseValue)))
    closeCut = expectedCycleEnd(cycle, app.state.settings.cycleDay).slice(0, 16)
    closeActual = ''
    closeNote = ''
    closeError = null
    closeOpen = true
  }

  function submitClose(event: SubmitEvent) {
    event.preventDefault()
    closeError = null
    const finalReading = parseDecimalInput(closeFinal)
    const billedText = String(closeBilled).trim()
    const billed = billedText === '' ? undefined : Number(billedText)
    if (finalReading == null || finalReading < 0) {
      closeError = 'La lectura final no es válida.'
      return
    }
    if (billed != null && (!Number.isInteger(billed) || billed < 0)) {
      closeError = 'El consumo facturado debe ser un entero de m³ (o dejalo vacío).'
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(closeCut)) {
      closeError = 'La fecha de corte no es válida.'
      return
    }
    const actual = parseDecimalInput(closeActual)
    try {
      closeCurrentCycle({
        cycleId: cycle.id,
        cutAt: `${closeCut}:00-06:00`,
        finalReading,
        billedM3: billed,
        lastReading: last?.value ?? null,
        lastReadingAt: last?.at ?? null,
        proposedCutAt: expectedCycleEnd(cycle, app.state.settings.cycleDay),
        note: closeNote.trim() || undefined,
        actualBill:
          actual != null && actual > 0
            ? {
                total: actual,
                billedM3: billed ?? 0,
                paidAt: nowIso(),
                note: closeNote.trim() || undefined,
              }
            : undefined,
      })
      closeOpen = false
      notify('Ciclo cerrado. Se creó el ciclo nuevo con la lectura final como base.')
    } catch (error) {
      closeError = error instanceof Error ? error.message : 'No se pudo cerrar el ciclo'
    }
  }

  function saveTariffs() {
    const next: Tariffs = {
      ...tariffs,
      iva: { ...tariffs.iva, rate: ivaPct / 100 },
      fixed: { ...tariffs.fixed },
      include: { ...tariffs.include },
    }
    updateSettings({ tariffs: next })
    notify('Tarifas guardadas')
  }

  function restoreTariffs() {
    tariffs = defaultTariffs()
    ivaPct = Math.round(ARESEP_TARIFFS_2026_10_23.iva.rate * 100)
    notify('Tarifas ARESEP restauradas (recordá guardar)')
  }

  function savePreferences() {
    updateSettings({
      cycleDay: Number(draft.cycleDay) || 20,
      gapWarnHours: Number(draft.gapWarnHours) || 36,
      baselineWindowDays: Number(draft.baselineWindowDays) || 14,
      outlier: {
        multiplier: Number(draft.multiplier) || 2,
        madFactor: Number(draft.madFactor) || 3,
      },
      flow: {
        ...app.state.settings.flow,
        warningLph: Number(draft.flowWarning) || 1,
        dangerLph: Number(draft.flowDanger) || 5,
      },
      note: { unexplainedWarnLiters: Number(draft.noteThreshold) || 2 },
      projection: { ...app.state.settings.projection, method: draft.method },
    })
    notify('Preferencias guardadas')
  }

  function saveGistSettings() {
    updateSettings({
      gist: {
        ...app.state.settings.gist,
        id: gistId.trim() || null,
        url: gistUrl.trim() || null,
      },
    })
    notify('Gist guardado')
  }

  function saveToken() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('medidor.gist.token', token.trim())
    }
    tokenStatus = token.trim() ? 'Token guardado en este dispositivo' : 'Token borrado'
  }

  async function testToken() {
    tokenStatus = 'Probando…'
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
        },
      })
      if (!response.ok) throw new Error(`GitHub respondió ${response.status}`)
      const data = (await response.json()) as { login: string }
      tokenStatus = `Conectado como ${data.login}`
    } catch (error) {
      tokenStatus = error instanceof Error ? error.message : 'No se pudo conectar'
    }
  }

  function chooseTheme(value: 'auto' | 'light' | 'dark') {
    updateSettings({ theme: value })
    setTheme(value)
  }

  async function handleFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const result =
      file.name.endsWith('.json') || text.trim().startsWith('{')
        ? importJsonText(text)
        : importCsvText(text)
    notify(
      result.errors.length > 0
        ? `Importado con avisos: ${result.errors[0]}`
        : `Importadas ${result.imported} lecturas`,
    )
    input.value = ''
  }

  async function reset() {
    if (!window.confirm('¿Borrar todos los datos locales y volver al CSV inicial?')) return
    await resetAll()
    notify('Datos locales restablecidos')
  }
</script>

<div>
  <h2>Ajustes</h2>
  <p class="small muted">Ciclo, tarifas, proyección, datos y privacidad.</p>
</div>

<InstallBanner />

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Aplicación instalada</div>
      <div class="card-subtitle">
        {pwa.installed ? 'Corriendo como app instalada' : 'Podés instalarla desde el navegador'} ·
        {pwa.offline ? 'sin conexión' : 'con conexión'} · service worker {pwa.swRegistered
          ? 'activo'
          : 'inactivo'}
      </div>
    </div>
    <span class="badge badge-{pwa.swRegistered ? 'ok' : 'neutral'}">
      {pwa.swRegistered ? 'offline listo' : 'sin SW'}
    </span>
  </div>
  {#if pwa.offlineReady}
    <p class="tiny text-ok">El shell ya quedó guardado para abrir sin internet.</p>
  {/if}
  {#if pwa.isIos && !pwa.installed}
    <p class="small muted" style="margin-top:8px">
      En iPhone/iPad: Safari → Compartir → “Agregar a pantalla de inicio”. Las notificaciones
      locales quedan para una versión futura.
    </p>
  {/if}
  <p class="tiny muted" style="margin-top:8px">
    Tus datos viven en IndexedDB. El service worker guarda el shell y las lecturas semilla; la app
    funciona completa sin red salvo la sincronización con el gist.
  </p>
  <button class="btn btn-sm" style="margin-top:8px" onclick={resetInstallBanner}>
    Mostrar aviso de instalación otra vez
  </button>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Ciclo actual</div>
      <div class="card-subtitle">
        {cycle.label} · cierre esperado {formatDate(
          expectedCycleEnd(cycle, app.state.settings.cycleDay),
        )}
      </div>
    </div>
    <span class="badge badge-info">base {formatM3(cycle.baseValue)} m³</span>
  </div>

  <div class="grid-2">
    <label class="field">
      <span class="label">Base del ciclo (m³)</span>
      <input class="input numeric" type="text" inputmode="decimal" bind:value={baseInput} />
    </label>
    <label class="field">
      <span class="label">Motivo del ajuste</span>
      <input class="input" type="text" bind:value={baseReason} />
    </label>
  </div>
  <div class="row row-wrap" style="margin-top:10px">
    <button class="btn btn-sm btn-primary" onclick={saveBase}>Guardar base</button>
    <button class="btn btn-sm" onclick={openClose}>Cerrar ciclo…</button>
    {#if last}
      <span class="chip">última lectura {formatM3(last.value)} m³</span>
    {/if}
  </div>

  {#if cycle.adjustments.length > 0}
    <details style="margin-top:12px">
      <summary class="small muted">Auditoría de ajustes ({cycle.adjustments.length})</summary>
      <div class="list" style="margin-top:8px">
        {#each cycle.adjustments as adjustment, index (adjustment.at + adjustment.field + index)}
          <div class="list-item">
            <div class="list-main">
              <div class="list-title small">
                {adjustment.field}: {String(adjustment.oldValue)} → {String(adjustment.newValue)}
              </div>
              <div class="list-sub">{adjustment.reason} · {formatDateTime(adjustment.at)}</div>
            </div>
          </div>
        {/each}
      </div>
    </details>
  {/if}
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Tarifas ARESEP</div>
      <div class="card-subtitle">{tariffs.source} · vigentes {tariffs.effectiveFrom}</div>
    </div>
    <span class="badge badge-neutral">{app.state.settings.currency}</span>
  </div>

  <div class="table-wrap">
    <table class="data" style="min-width:520px">
      <thead>
        <tr>
          <th>Bloque</th>
          {#each TARIFF_COMPONENTS as component (component)}
            <th class="num">{COMPONENT_SHORT[component]}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tariffs.blocks as block, index (block.upTo ?? 'last')}
          <tr>
            <td>{block.upTo === null ? '61+' : `1–${block.upTo}`}</td>
            {#each TARIFF_COMPONENTS as component (component)}
              <td>
                <input
                  class="input numeric"
                  style="min-height:36px;padding:4px 6px;text-align:right;width:68px;font-size:0.8rem"
                  type="number"
                  min="0"
                  step="1"
                  value={block[component]}
                  aria-label={`Bloque ${index + 1} ${component}`}
                  oninput={(event) =>
                    (block[component] = Number((event.currentTarget as HTMLInputElement).value))}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="grid-2" style="margin-top:12px">
    {#each TARIFF_COMPONENTS as component (component)}
      <label class="field">
        <span class="label">Cargo fijo {COMPONENT_SHORT[component]}</span>
        <input
          class="input numeric"
          type="number"
          min="0"
          value={tariffs.fixed[component]}
          oninput={(event) =>
            (tariffs.fixed[component] = Number((event.currentTarget as HTMLInputElement).value))}
        />
      </label>
    {/each}
    <label class="field">
      <span class="label">IVA (%)</span>
      <input class="input numeric" type="number" min="0" max="100" bind:value={ivaPct} />
    </label>
    <label class="field">
      <span class="label">Umbral IVA (m³)</span>
      <input
        class="input numeric"
        type="number"
        min="0"
        value={tariffs.iva.thresholdM3}
        oninput={(event) =>
          (tariffs.iva.thresholdM3 = Number((event.currentTarget as HTMLInputElement).value))}
      />
    </label>
  </div>

  <div class="row row-wrap" style="margin-top:8px">
    <label class="check">
      <input type="checkbox" bind:checked={tariffs.include.alcantarillado} /> Alcantarillado
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={tariffs.include.hidrantes} /> Hidrantes
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={tariffs.include.tprh} /> TPRH
    </label>
  </div>

  <div class="row row-wrap" style="margin-top:10px">
    <button class="btn btn-sm btn-primary" onclick={saveTariffs}>Guardar tarifas</button>
    <button class="btn btn-sm" onclick={restoreTariffs}>Restaurar ARESEP 2026-10-23</button>
  </div>
  <p class="tiny muted" style="margin-top:8px">
    Regla: si el consumo facturable supera {tariffs.iva.thresholdM3} m³, el IVA se aplica a todo el acueducto
    (bloques + cargo fijo), no solo al bloque marginal.
  </p>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Proyección y alertas</div>
      <div class="card-subtitle">Valores usados por el radar y la factura estimada.</div>
    </div>
  </div>
  <div class="grid-2">
    <label class="field">
      <span class="label">Día de corte</span>
      <input class="input numeric" type="number" min="1" max="28" bind:value={draft.cycleDay} />
    </label>
    <label class="field">
      <span class="label">Alerta sin lectura (horas)</span>
      <input class="input numeric" type="number" min="12" bind:value={draft.gapWarnHours} />
    </label>
    <label class="field">
      <span class="label">Ventana de la mediana (días)</span>
      <input class="input numeric" type="number" min="5" bind:value={draft.baselineWindowDays} />
    </label>
    <label class="field">
      <span class="label">Outlier: × mediana</span>
      <input class="input numeric" type="number" step="0.1" min="1" bind:value={draft.multiplier} />
    </label>
    <label class="field">
      <span class="label">Outlier: factor MAD</span>
      <input class="input numeric" type="number" step="0.5" min="1" bind:value={draft.madFactor} />
    </label>
    <label class="field">
      <span class="label">Flujo: ojo (L/h)</span>
      <input
        class="input numeric"
        type="number"
        step="0.1"
        min="0"
        bind:value={draft.flowWarning}
      />
    </label>
    <label class="field">
      <span class="label">Flujo: rojo (L/h)</span>
      <input class="input numeric" type="number" step="0.1" min="0" bind:value={draft.flowDanger} />
    </label>
    <label class="field">
      <span class="label">Nota: litros no explicados</span>
      <input
        class="input numeric"
        type="number"
        step="1"
        min="0"
        bind:value={draft.noteThreshold}
      />
    </label>
    <label class="field">
      <span class="label">Método de proyección</span>
      <select class="select" bind:value={draft.method}>
        <option value="worst">Peor escenario</option>
        <option value="expected">Esperado</option>
        <option value="both">Ambos</option>
      </select>
    </label>
  </div>
  <button class="btn btn-sm btn-primary" style="margin-top:10px" onclick={savePreferences}>
    Guardar preferencias
  </button>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Datos</div>
      <div class="card-subtitle">CSV atómico, JSON completo, importación y borrado.</div>
    </div>
  </div>
  <div class="row row-wrap">
    <button
      class="btn btn-sm"
      onclick={() => downloadFile('data.csv', exportCsv(), 'text/csv;charset=utf-8')}
    >
      <Icon name="download" size={15} /> data.csv
    </button>
    <button
      class="btn btn-sm"
      onclick={() => downloadFile('medidor-backup.json', exportJson(), 'application/json')}
    >
      <Icon name="download" size={15} /> backup JSON
    </button>
    <label class="btn btn-sm" style="cursor:pointer">
      <Icon name="install" size={15} /> Importar CSV/JSON
      <input
        type="file"
        accept=".csv,.json,text/csv,application/json"
        hidden
        onchange={handleFile}
      />
    </label>
  </div>
  <p class="tiny muted" style="margin-top:8px">
    El CSV guarda solo fecha, medición y nota. Consumo, litros, L/h y costos se recalculan.
  </p>
  <button class="btn btn-sm btn-outline-danger" style="margin-top:10px" onclick={reset}>
    Borrar datos locales y volver al CSV inicial
  </button>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Gist de GitHub</div>
      <div class="card-subtitle">Opcional. El token queda solo en este dispositivo.</div>
    </div>
    <span class="badge badge-neutral">fase 4</span>
  </div>
  <div class="stack-sm">
    <label class="field">
      <span class="label">Token fine-grained (Gists: write)</span>
      <input
        class="input"
        type="password"
        bind:value={token}
        autocomplete="off"
        placeholder="github_pat_…"
      />
    </label>
    <div class="row row-wrap">
      <button class="btn btn-sm" onclick={saveToken}>Guardar token</button>
      <button class="btn btn-sm" onclick={() => void testToken()}>Probar conexión</button>
      <button
        class="btn btn-sm btn-ghost"
        onclick={() => {
          token = ''
          saveToken()
        }}
      >
        Olvidar token
      </button>
    </div>
    {#if tokenStatus}<p class="tiny muted">{tokenStatus}</p>{/if}
    <div class="grid-2">
      <label class="field">
        <span class="label">Gist ID</span>
        <input class="input" type="text" bind:value={gistId} />
      </label>
      <label class="field">
        <span class="label">URL del gist</span>
        <input class="input" type="url" bind:value={gistUrl} />
      </label>
    </div>
    <button class="btn btn-sm" onclick={saveGistSettings}>Guardar gist</button>
    <p class="tiny muted">
      La sincronización automática (pull/push y merge) llega en la siguiente fase. Mientras tanto,
      usá el backup JSON o el CSV.
    </p>
  </div>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Apariencia</div>
      <div class="card-subtitle">
        Actual: {theme.preference === 'auto' ? `automático (${theme.resolved})` : theme.preference}
      </div>
    </div>
  </div>
  <div class="row row-wrap">
    <button
      class="btn btn-sm"
      class:btn-primary={theme.preference === 'auto'}
      onclick={() => chooseTheme('auto')}>Automático</button
    >
    <button
      class="btn btn-sm"
      class:btn-primary={theme.preference === 'light'}
      onclick={() => chooseTheme('light')}>Claro</button
    >
    <button
      class="btn btn-sm"
      class:btn-primary={theme.preference === 'dark'}
      onclick={() => chooseTheme('dark')}>Oscuro</button
    >
  </div>
</div>

<div class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Acerca de</div>
      <div class="card-subtitle">Medidor AYA 0.1.0 · Svelte 5 · datos locales</div>
    </div>
  </div>
  <div class="row row-wrap">
    <button class="btn btn-sm" onclick={() => go('instrucciones')}>
      <Icon name="book" size={15} /> Instrucciones
    </button>
    <a
      class="btn btn-sm"
      href="https://github.com/andres3336/medidor"
      target="_blank"
      rel="noreferrer"
    >
      Repositorio
    </a>
  </div>
  <p class="tiny muted" style="margin-top:8px">
    Zona horaria America/Costa_Rica (UTC-6). Formato numérico con punto decimal y coma de miles.
    Ningún dato se envía a terceros; el gist es opcional y público si lo creás.
  </p>
</div>

<Modal bind:open={closeOpen} title="Cerrar ciclo {cycle.id}" onclose={() => (closeOpen = false)}>
  <form onsubmit={submitClose} class="stack">
    <p class="small muted">
      Cierre manual y auditable. La lectura final se convierte en la base del ciclo nuevo.
    </p>
    <div class="grid-2">
      <label class="field">
        <span class="label">Lectura final (m³)</span>
        <input
          class="input numeric"
          type="text"
          inputmode="decimal"
          bind:value={closeFinal}
          required
        />
      </label>
      <label class="field">
        <span class="label">Consumo facturado (m³)</span>
        <input class="input numeric" type="number" min="0" bind:value={closeBilled} />
      </label>
      <label class="field">
        <span class="label">Fecha y hora de corte</span>
        <input class="input" type="datetime-local" bind:value={closeCut} required />
      </label>
      <label class="field">
        <span class="label">Monto real (₡, opcional)</span>
        <input class="input numeric" type="number" min="0" bind:value={closeActual} />
      </label>
    </div>
    <label class="field">
      <span class="label">Nota del cierre</span>
      <textarea
        class="textarea"
        bind:value={closeNote}
        placeholder="Ej. AYA cortó el 21, facturó 21 m³"></textarea>
    </label>
    {#if closeError}<p class="small text-danger">{closeError}</p>{/if}
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" onclick={() => (closeOpen = false)}
        >Cancelar</button
      >
      <button type="submit" class="btn btn-primary">Cerrar ciclo y crear el nuevo</button>
    </div>
  </form>
</Modal>

{#if toast}
  <div class="floating-toast" role="status">{toast}</div>
{/if}
