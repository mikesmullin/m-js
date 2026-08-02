import { Router } from '../dist/m.min.js';

export default function Guide() {
  return {
    template: `
      <article class="space-y-10 max-w-none">
        <header class="space-y-2">
          <p class="text-cyan-400/80 font-mono text-sm uppercase tracking-widest">Guide</p>
          <h1 class="text-3xl font-bold text-white">Quick start</h1>
          <p class="text-slate-400">Alpine-compatible API — put reactivity in the markup.</p>
        </header>

        <section class="space-y-3">
          <h2 class="text-xl font-semibold text-cyan-200">1. Install & run</h2>
          <pre class="code-block"><code>bun install
bun run dev</code></pre>
        </section>

        <section class="space-y-3">
          <h2 class="text-xl font-semibold text-cyan-200">2. Directives (x-*)</h2>
          <p class="text-sm text-slate-400">Same names as Alpine.js. Prefer these over hand-written methods when you can.</p>
          <div class="overflow-x-auto m-table-wrap">
            <table class="m-table">
              <thead><tr><th>Directive</th><th>Purpose</th></tr></thead>
              <tbody>
                <tr><td class="font-mono text-pink-300">x-data</td><td>Declare component state</td></tr>
                <tr><td class="font-mono text-pink-300">x-bind / :attr</td><td>Bind attributes</td></tr>
                <tr><td class="font-mono text-pink-300">x-on / @event</td><td>Event listeners</td></tr>
                <tr><td class="font-mono text-pink-300">x-text / x-html</td><td>Text / HTML content</td></tr>
                <tr><td class="font-mono text-pink-300">x-model</td><td>Two-way input binding</td></tr>
                <tr><td class="font-mono text-pink-300">x-show / x-if</td><td>Visibility / conditional DOM</td></tr>
                <tr><td class="font-mono text-pink-300">x-for</td><td>List rendering</td></tr>
                <tr><td class="font-mono text-pink-300">x-init / x-effect</td><td>Init + reactive side effects</td></tr>
                <tr><td class="font-mono text-pink-300">x-ref / x-cloak / x-ignore</td><td>Refs, FOUC hide, skip trees</td></tr>
                <tr><td class="font-mono text-pink-300">x-transition</td><td>Simple show/hide transitions</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-xl font-semibold text-cyan-200">3. Magics</h2>
          <pre class="code-block"><code>$store   <span class="cm">// M.store('name')</span>
$el      <span class="cm">// current element</span>
$refs    <span class="cm">// x-ref map</span>
$dispatch(<span class="str">'evt'</span>, detail)
$watch(<span class="str">'count'</span>, (v, old) => ...)
$nextTick(() => ...)</code></pre>
        </section>

        <section class="space-y-3">
          <h2 class="text-xl font-semibold text-cyan-200">4. M.data() & M.store()</h2>
          <pre class="code-block"><code>M.data(<span class="str">'dropdown'</span>, () => ({
  open: <span class="kw">false</span>,
  toggle() { <span class="kw">this</span>.open = !<span class="kw">this</span>.open },
}))

M.store(<span class="str">'notifications'</span>, {
  items: [],
  notify(msg) { <span class="kw">this</span>.items.push(msg) },
})

<span class="cm">// template</span>
&lt;div x-data=<span class="str">"dropdown"</span>&gt;
  &lt;button @click=<span class="str">"toggle"</span>&gt;…&lt;/button&gt;
  &lt;div x-show=<span class="str">"open"</span>&gt;…&lt;/div&gt;
&lt;/div&gt;
&lt;button @click=<span class="str">"$store.notifications.notify('hi')"</span>&gt;Notify&lt;/button&gt;</code></pre>
        </section>

        <section class="space-y-3">
          <h2 class="text-xl font-semibold text-cyan-200">5. Router</h2>
          <pre class="code-block"><code><span class="kw">import</span> M, { Router } <span class="kw">from</span> <span class="str">'m-js'</span>

Router.register(<span class="str">'/'</span>, <span class="str">'Home'</span>, () => Home())
M.mount(<span class="str">'#app'</span>)</code></pre>
        </section>

        <div class="flex gap-3 pt-4">
          <a href="/api" class="m-btn m-btn-primary" @click="go">API reference →</a>
          <a href="https://mikesmullin.github.io/m-js-components/" class="m-btn m-btn-secondary" target="_blank" rel="noopener">Storybook →</a>
        </div>
      </article>
    `,
    go: Router.link,
  };
}
