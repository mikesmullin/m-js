/**
 * HMR + Store demo — M.store + x-* directives
 * JS stays thin; template owns the reactivity wiring.
 */
import M from '../m/m.js';
import { Router } from '../m/router.js';

// Global store — survives HMR (named bucket)
M.store('hmrDemo', {
  clicks: M.store('hmrDemo')?.clicks ?? 0,
  note:
    M.store('hmrDemo')?.note ??
    'Edit docs/pages/hmr.js while this is open — count & note persist.',
  hmrTicks: M.store('hmrDemo')?.hmrTicks ?? 0,
  inc() {
    this.clicks++;
  },
  setNote(note) {
    this.note = note;
  },
  tickHmr() {
    this.hmrTicks++;
  },
});

if (typeof window !== 'undefined' && !window.__M_HMR_DEMO_BOUND__) {
  window.__M_HMR_DEMO_BOUND__ = true;
  window.addEventListener('m:hmr', () => {
    M.store('hmrDemo').tickHmr();
  });
}

export default function HmrDemo() {
  return {
    template: `
      <article class="space-y-8" x-data>
        <header class="space-y-2">
          <p class="text-cyan-400/80 font-mono text-sm uppercase tracking-widest">Live proof</p>
          <h1 class="text-3xl font-bold text-white">HMR · Router · Store</h1>
          <p class="text-slate-400 max-w-2xl">
            Hot reload keeps your route and <code class="text-pink-300">$store</code> state.
            Stay on <code class="text-cyan-300">/hmr</code> with data intact.
          </p>
        </header>

        <div class="grid md:grid-cols-3 gap-4">
          <div class="neon-card p-5 space-y-3">
            <div class="flex items-center gap-2 text-sm text-slate-400">
              <i class="ph ph-map-pin text-cyan-400"></i> Router URL
            </div>
            <p class="font-mono text-2xl text-cyan-300" x-text="uri"></p>
            <p class="text-xs text-slate-500">Should remain <span class="text-pink-300">/hmr</span> after HMR.</p>
          </div>

          <div class="neon-card p-5 space-y-3">
            <div class="flex items-center gap-2 text-sm text-slate-400">
              <i class="ph ph-database text-pink-400"></i> Store clicks
            </div>
            <p class="font-mono text-2xl text-pink-300" x-text="$store.hmrDemo.clicks"></p>
            <button type="button" class="m-btn m-btn-primary" @click="$store.hmrDemo.inc()">
              <i class="ph ph-plus"></i> Increment
            </button>
          </div>

          <div class="neon-card p-5 space-y-3">
            <div class="flex items-center gap-2 text-sm text-slate-400">
              <i class="ph ph-lightning text-purple-400"></i> HMR events
            </div>
            <p class="font-mono text-2xl text-purple-300" x-text="$store.hmrDemo.hmrTicks"></p>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <span class="hmr-dot"></span>
              <span x-text="hmrStatus"></span>
            </div>
          </div>
        </div>

        <div class="neon-card p-5 space-y-3">
          <label class="m-label">Persisted note ($store)</label>
          <textarea
            class="m-input min-h-[100px] font-mono text-sm"
            x-model="$store.hmrDemo.note"
          ></textarea>
          <p class="text-xs text-slate-500">
            Tip: edit the banner string below in <code class="text-cyan-300">docs/pages/hmr.js</code> and save.
          </p>
        </div>

        <div class="neon-card p-5 space-y-2 border-pink-500/20">
          <h2 class="font-semibold text-pink-300 flex items-center gap-2">
            <i class="ph ph-info"></i> How to verify
          </h2>
          <ol class="list-decimal list-inside text-sm text-slate-400 space-y-1">
            <li>Click <strong class="text-slate-200">Increment</strong> a few times</li>
            <li>Type something unique in the note field</li>
            <li>Edit and save this file or <code class="text-cyan-300">docs/styles.css</code></li>
            <li>Confirm URL, clicks & note unchanged; banner text updates</li>
          </ol>
        </div>

        <p class="text-center text-sm font-mono text-cyan-500/80" x-text="banner"></p>
      </article>
    `,
    uri: Router.uri,
    banner: '✨ HMR banner — M.store + x-* directives',
    get hmrStatus() {
      return document.documentElement.dataset.hmr || 'unknown';
    },
  };
}
