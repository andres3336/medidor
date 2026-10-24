<script lang="ts">
  import snarkdown from 'snarkdown'
  import raw from '../../instructions.md?raw'
  import { go } from '$lib/router.svelte'
  import Icon from '$lib/components/Icon.svelte'

  const html = $derived(snarkdown(raw))
</script>

<div class="between">
  <div>
    <h2>Instrucciones</h2>
    <p class="small muted">Cómo lee la app tus datos y cómo se calcula todo.</p>
  </div>
  <button class="btn btn-sm" onclick={() => go('hoy')}>
    <Icon name="arrowRight" size={15} /> Volver a Hoy
  </button>
</div>

<article class="card flat prose">
  {@html html}
</article>

<style>
  .prose {
    font-size: 0.92rem;
    line-height: 1.62;
  }

  .prose :global(h1) {
    font-size: 1.35rem;
    margin: 0 0 12px;
  }

  .prose :global(h2) {
    font-size: 1.05rem;
    margin: 22px 0 8px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .prose :global(h2:first-of-type) {
    margin-top: 8px;
    border-top: 0;
    padding-top: 0;
  }

  .prose :global(h3) {
    font-size: 0.95rem;
    margin: 16px 0 6px;
  }

  .prose :global(p) {
    margin: 8px 0;
  }

  .prose :global(ul),
  .prose :global(ol) {
    margin: 8px 0;
    padding-left: 22px;
  }

  .prose :global(li) {
    margin: 4px 0;
  }

  .prose :global(code) {
    background: var(--surface-2);
    padding: 1px 5px;
    border-radius: 5px;
    font-size: 0.85em;
  }

  .prose :global(pre) {
    background: var(--surface-2);
    padding: 10px 12px;
    border-radius: 10px;
    overflow-x: auto;
  }

  .prose :global(pre code) {
    background: none;
    padding: 0;
  }

  .prose :global(blockquote) {
    margin: 10px 0;
    padding: 8px 12px;
    border-left: 3px solid var(--accent);
    background: var(--accent-soft);
    border-radius: 0 10px 10px 0;
  }

  .prose :global(strong) {
    color: var(--text);
  }

  .prose :global(a) {
    text-decoration: underline;
  }
</style>
