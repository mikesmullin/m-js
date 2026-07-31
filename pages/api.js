import { Router } from '../m/router.js';

const SECTIONS = [
  {
    id: 'directives',
    title: 'Directives (x-*)',
    items: [
      { name: 'x-data', desc: 'Component state object or registered name via M.data()' },
      { name: 'x-bind / :attr', desc: 'Bind any attribute (class, disabled, href, …)' },
      { name: 'x-on / @event', desc: 'Listeners; modifiers: .prevent .stop .once .window .outside .debounce' },
      { name: 'x-text / x-html', desc: 'Text content / innerHTML' },
      { name: 'x-model', desc: 'Two-way bind inputs; .lazy .number modifiers' },
      { name: 'x-show / x-if', desc: 'CSS hide vs conditional DOM (template supported)' },
      { name: 'x-for', desc: 'item in items — clones element or <template>' },
      { name: 'x-init / x-effect', desc: 'Run on init / re-run when deps change' },
      { name: 'x-ref / x-cloak / x-ignore', desc: 'Named refs, hide until ready, skip subtrees' },
      { name: 'x-transition', desc: 'Opacity transition with x-show' },
      { name: 'm-mount', desc: 'm.js: nest a { template, ... } child component' },
    ],
  },
  {
    id: 'magics',
    title: 'Magics ($*)',
    items: [
      { name: '$store', desc: 'Access M.store(name) globals' },
      { name: '$el', desc: 'Current element' },
      { name: '$refs', desc: 'Map of x-ref names under the component root' },
      { name: '$dispatch(name, detail)', desc: 'Bubble a CustomEvent' },
      { name: '$watch(prop, cb)', desc: 'Run cb when prop expression changes' },
      { name: '$nextTick(fn)', desc: 'After DOM updates (microtask)' },
    ],
  },
  {
    id: 'methods',
    title: 'M methods',
    items: [
      { name: 'M.data(name, factory)', desc: 'Register reusable x-data component' },
      { name: 'M.store(name, value?)', desc: 'Get/set global reactive store (HMR-safe)' },
      { name: 'M.start(root?)', desc: 'Init x-* trees under root (default body)' },
      { name: 'M.mount(el, factory?)', desc: 'Mount app; default factory = Router.render' },
      { name: 'M.redraw() / deferredBatchRedraw()', desc: 'Remount root (route changes)' },
      { name: 'M.reactive / effect', desc: 'Low-level reactivity primitives' },
    ],
  },
  {
    id: 'router',
    title: 'Router',
    items: [
      { name: 'Router.register(uri, title, fn)', desc: 'Path route; :params supported' },
      { name: 'Router.set / get / uri / params', desc: 'Navigate and read location' },
      { name: 'Router.link(event)', desc: 'Internal <a> click handler' },
    ],
  },
];

export default function Api() {
  return {
    template: `
      <article class="space-y-10">
        <header class="space-y-2">
          <p class="text-cyan-400/80 font-mono text-sm uppercase tracking-widest">API</p>
          <h1 class="text-3xl font-bold text-white">Reference</h1>
          <p class="text-slate-400">M.* API + Alpine-style x-* directives + Router/HMR.</p>
        </header>

        <section x-for="sec in sections" class="space-y-4">
          <h2 class="text-xl font-semibold text-cyan-200" :id="sec.id" x-text="sec.title"></h2>
          <div class="space-y-2">
            <div x-for="item in sec.items" class="neon-card p-4 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
              <code class="text-pink-300 font-mono text-sm shrink-0" x-text="item.name"></code>
              <span class="text-sm text-slate-400" x-text="item.desc"></span>
            </div>
          </div>
        </section>

        <a href="/guide" class="m-btn m-btn-secondary" @click="go">← Guide</a>
      </article>
    `,
    sections: SECTIONS,
    go: Router.link,
  };
}
