<script lang="ts">
  import { app, toggleFlag } from '$lib/state/store.svelte'
  import { deriveAnalytics } from '$lib/state/derive'
  import { formatDayMonth, formatWeekday, startOfDay } from '$lib/domain/dates'
  import {
    formatLiters,
    formatLph,
    formatM3,
    formatMoney,
    formatMoneyShort,
    formatMultiplier,
    formatNumber,
  } from '$lib/domain/format'
  import { go } from '$lib/router.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import Radar7 from '$lib/components/Radar7.svelte'
  import BillCard from '$lib/components/BillCard.svelte'
  import LeakCard from '$lib/components/LeakCard.svelte'
  import ConclusionCard from '$lib/components/ConclusionCard.svelte'
  import InstallBanner from '$lib/components/InstallBanner.svelte'
  import ReadingForm from '$lib/components/ReadingForm.svelte'
  import GapsAlert from '$lib/components/GapsAlert.svelte'

  const analytics = $derived(deriveAnalytics(app.state))
  const hero = $derived(analytics.yesterday ?? analytics.days.at(-1) ?? null)
  const heroIsYesterday = $derived(analytics.yesterday !== null)
  const multiplier = $derived(
    hero && analytics.baseline.median > 0 ? hero.litersPerDay / analytics.baseline.median : 0,
  )
  const tone = $derived.by(() => {
    if (!hero) return 'ok'
    if (analytics.yesterdayIsOutlier || multiplier >= 2) return 'danger'
    if (multiplier >= 1.4) return 'warn'
    return 'ok'
  })
  const heroReading = $derived(
    hero ? app.state.readings.find((reading) => reading.at === hero.at && !reading.deleted) : null,
  )
  const costRatio = $derived(
    analytics.yesterdayCost != null && analytics.previousCost != null && analytics.previousCost > 0
      ? analytics.yesterdayCost / analytics.previousCost
      : null,
  )
  const last = $derived(analytics.readings.at(-1) ?? null)
  const progressPct = $derived(
    analytics.projection
      ? Math.min(
          100,
          (analytics.projection.elapsedDays /
            Math.max(1, analytics.projection.elapsedDays + analytics.projection.remainingDays)) *
            100,
        )
      : 0,
  )
  const topConclusions = $derived(analytics.conclusions.slice(0, 3))

  let quickAdd = $state(false)
  let gapsOpen = $state(false)
  let gapPromptShown = $state(false)
  let seedDismissed = $state(false)

  $effect(() => {
    if (!app.ready || gapPromptShown) return
    if (analytics.gaps.unacknowledged.length > 0) {
      gapPromptShown = true
      gapsOpen = true
      navigator.vibrate?.(120)
    }
  })

  function markIncident() {
    if (heroReading) toggleFlag(heroReading.id)
    else quickAdd = true
  }
</script>

<InstallBanner />

{#if app.seedWarning && !seedDismissed}
  <div class="banner">
    <Icon name="check" size={18} />
    <div class="list-main">
      <div class="list-title">Datos iniciales cargados</div>
      <div class="list-sub">{app.seedWarning}. Ya podés agregar lecturas.</div>
    </div>
    <button class="btn btn-sm btn-ghost" onclick={() => (seedDismissed = true)}>Ok</button>
  </div>
{/if}

{#if analytics.closeDue}
  <div class="card danger">
    <div class="row" style="align-items:flex-start">
      <Icon name="alert" size={20} />
      <div class="list-main">
        <div class="list-title">Cierre de ciclo pendiente</div>
        <div class="list-sub">
          Ya pasó el día {app.state.settings.cycleDay}. Ajustá la lectura final y la base para no
          arrastrar el error al ciclo nuevo.
        </div>
        <button class="btn btn-sm btn-danger" style="margin-top:8px" onclick={() => go('ajustes')}>
          Cerrar ciclo
        </button>
      </div>
    </div>
  </div>
{/if}

{#if analytics.gaps.unacknowledged.length > 0}
  <div class="card warn">
    <div class="between">
      <div class="row" style="align-items:flex-start">
        <Icon name="alert" size={18} />
        <div>
          <div class="list-title">
            {analytics.gaps.unacknowledged.length}
            {analytics.gaps.unacknowledged.length === 1 ? 'día' : 'días'} sin lectura
          </div>
          <div class="list-sub">El radar pierde precisión con huecos.</div>
        </div>
      </div>
      <button class="btn btn-sm" onclick={() => (gapsOpen = true)}>Revisar</button>
    </div>
  </div>
{/if}

{#if hero}
  <section class="card hero" aria-labelledby="hero-title">
    <div class="between">
      <div>
        <div class="eyebrow" id="hero-title">
          {#if heroIsYesterday}
            Ayer · {formatWeekday(startOfDay(hero.day))} {formatDayMonth(startOfDay(hero.day))}
          {:else}
            Últimas {formatNumber(hero.hours, 0)} h
          {/if}
        </div>
        <div class="hero-number">
          {#if heroIsYesterday}
            {formatNumber(hero.litersPerDay, 0)}<span class="hero-unit">L/día</span>
          {:else}
            {formatNumber(hero.liters, 0)}<span class="hero-unit"
              >L en {formatNumber(hero.hours, 0)} h</span
            >
          {/if}
        </div>
      </div>
      <span class="badge badge-{tone}">
        {tone === 'ok' ? 'normal' : tone === 'warn' ? 'ojo' : 'raro'}
      </span>
    </div>

    <div class="row row-wrap" style="margin-top:12px;gap:8px">
      {#if multiplier > 0}
        <span class="badge badge-{tone}">{formatMultiplier(multiplier)} tu mediana</span>
      {/if}
      <span class="chip">{formatLiters(analytics.baseline.median)}/día normal</span>
      {#if multiplier >= 1.5}
        <span class="chip">≈ {formatMultiplier(multiplier)} días normales en uno</span>
      {/if}
    </div>

    <p class="small" style="margin-top:10px">
      {#if heroIsYesterday}
        Tu mediana reciente es {formatLiters(analytics.baseline.median)}/día.
        {#if hero.litersPerDay > analytics.baseline.p75}
          Ayer quedó por encima de la banda normal ({formatLiters(
            analytics.baseline.p25,
          )}–{formatLiters(analytics.baseline.p75)}).
        {:else}
          Ayer quedó dentro de la banda normal ({formatLiters(
            analytics.baseline.p25,
          )}–{formatLiters(analytics.baseline.p75)}).
        {/if}
      {:else}
        No hay lectura de ayer: muestro el último intervalo completo. Agregá la lectura de hoy para
        recuperar el radar diario.
      {/if}
    </p>

    {#if analytics.yesterdayCost != null}
      <p class="small" style="margin-top:6px">
        Costo aproximado: <strong>{formatMoney(analytics.yesterdayCost)}</strong>
        {#if analytics.previousCost != null}
          <span class="muted">
            · día anterior {formatMoney(analytics.previousCost)}
            {#if costRatio != null}({formatMultiplier(costRatio)}){/if}
          </span>
        {/if}
      </p>
    {/if}

    <div class="row row-wrap" style="margin-top:12px">
      <button class="btn btn-primary" onclick={() => (quickAdd = true)}>
        <Icon name="plus" size={17} /> Agregar lectura
      </button>
      <button class="btn" onclick={markIncident}>
        <Icon name="star" size={16} filled={heroReading?.flag} />
        {heroReading?.flag ? 'Quitar incidente' : 'Marcar incidente'}
      </button>
      <button class="btn btn-ghost" onclick={() => go('lecturas')}>
        Ver detalle <Icon name="arrowRight" size={15} />
      </button>
    </div>
  </section>
{:else}
  <section class="card hero">
    <div class="eyebrow">Primer paso</div>
    <h2 style="margin-top:6px">Agregá tu primera lectura</h2>
    <p class="small muted" style="margin-top:6px">
      Sin dos lecturas no puedo calcular consumo, flujo ni anomalías. El CSV inicial se carga solo.
    </p>
    <button class="btn btn-primary" style="margin-top:12px" onclick={() => (quickAdd = true)}>
      <Icon name="plus" size={17} /> Agregar lectura
    </button>
  </section>
{/if}

<section class="card flat">
  <div class="card-header">
    <div>
      <div class="card-title">Radar 7 días</div>
      <div class="card-subtitle">Litros por día normalizados por intervalo.</div>
    </div>
    <span class="badge badge-neutral">{formatLph(analytics.flow.basalLph)} basal</span>
  </div>
  <Radar7
    days={analytics.days.slice(-7)}
    baseline={analytics.baseline}
    outlierAt={analytics.anomalies.map((anomaly) => anomaly.at)}
  />
</section>

{#each topConclusions as conclusion (conclusion.id)}
  <ConclusionCard
    tone={conclusion.tone}
    icon={conclusion.tone === 'ok' ? 'check' : 'alert'}
    title={conclusion.title}
    detail={conclusion.detail}
    action={conclusion.action}
    onaction={() => go(conclusion.id === 'close-due' ? 'ajustes' : 'analisis')}
  />
{/each}

<section class="card flat">
  <div class="between">
    <div>
      <div class="card-title">Ciclo actual</div>
      <div class="card-subtitle">
        Base {formatM3(analytics.cycle.baseValue)} m³ · {formatM3(
          analytics.projection?.currentExactM3 ?? 0,
        )} m³ consumidos
      </div>
    </div>
    {#if last}
      <span class="badge badge-info">{formatM3(last.value)} m³</span>
    {/if}
  </div>
  <div class="progress" style="margin-top:12px" aria-hidden="true">
    <span style="width:{progressPct}%"></span>
  </div>
  <div class="between tiny muted" style="margin-top:6px">
    <span>
      {#if analytics.projection}
        {formatNumber(analytics.projection.elapsedDays, 0)} días transcurridos
      {:else}
        sin proyección
      {/if}
    </span>
    <span>
      {#if analytics.projection}
        {formatNumber(analytics.projection.remainingDays, 0)} días para el cierre
      {/if}
    </span>
  </div>
  {#if analytics.projection?.m3ToNextThreshold.thirty != null}
    <p class="tiny muted" style="margin-top:8px">
      Faltan {formatM3(analytics.projection.m3ToNextThreshold.thirty, 0)} m³ para los 30 (IVA).
    </p>
  {:else}
    <p class="tiny text-warn" style="margin-top:8px">
      Ya pasaste los 30 m³: el IVA aplica a todo el acueducto.
    </p>
  {/if}
  {#if last && last.value < analytics.cycle.baseValue}
    <p class="small text-danger" style="margin-top:8px">
      Dato dudoso: la última lectura ({formatM3(last.value)} m³) es menor que la base del ciclo.
    </p>
  {/if}
</section>

<BillCard projection={analytics.projection} currentBill={analytics.currentBill} />

<LeakCard flow={analytics.flow} leaks={analytics.leaks} />

{#if last}
  <p class="tiny muted text-right">
    Última lectura: {formatM3(last.value)} m³ · {formatMoneyShort(
      analytics.currentBill.displayTotal,
    )} estimados a hoy · guardado local {app.dirty ? 'pendiente' : 'al día'}
  </p>
{/if}

<button class="fab" type="button" onclick={() => (quickAdd = true)} aria-label="Agregar lectura">
  <Icon name="plus" size={24} />
</button>

<ReadingForm bind:open={quickAdd} onclose={() => (quickAdd = false)} />
<GapsAlert bind:open={gapsOpen} gaps={analytics.gaps} onadd={() => (quickAdd = true)} />

<style>
  .fab {
    position: fixed;
    right: max(16px, calc(50% - 410px + 16px));
    bottom: calc(var(--nav-height) + 20px + env(safe-area-inset-bottom));
    z-index: 45;
    width: 54px;
    height: 54px;
    border-radius: 18px;
    border: 0;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    box-shadow: 0 10px 24px rgb(10 99 201 / 0.4);
    cursor: pointer;
  }

  @media (min-width: 860px) {
    .fab {
      right: calc(50% - 410px + 16px);
    }
  }
</style>
