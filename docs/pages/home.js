import { Router } from '../m/router.js';

export default function Home() {
  return {
    template: `
      <article class="space-y-10">
        <header class="space-y-4">
          <p class="text-cyan-400/80 font-mono text-sm tracking-widest uppercase">m.js · v3</p>
          <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
            <span class="bg-gradient-to-r from-cyan-300 via-blue-300 to-pink-400 bg-clip-text text-transparent">
              Minimalist UI
            </span>
            <br />for the modern web
          </h1>
          <p class="text-lg text-slate-400 max-w-2xl leading-relaxed">
            Alpine-style <code class="text-pink-300">x-*</code> directives, <code class="text-pink-300">$store</code>,
            client Router, and hot reload — zero runtime deps, Bun for dev. API is <code class="text-pink-300">M.*</code>.
          </p>
          <div class="flex flex-wrap gap-3 pt-2">
            <a href="/guide" class="m-btn m-btn-primary m-btn-lg" @click="go">
              <i class="ph ph-rocket-launch"></i> Get started
            </a>
            <a href="/storybook" class="m-btn m-btn-secondary m-btn-lg" @click="go">
              <i class="ph ph-squares-four"></i> Storybook
            </a>
            <a href="/hmr" class="m-btn m-btn-secondary m-btn-lg" @click="go">
              <i class="ph ph-lightning"></i> HMR demo
            </a>
          </div>
        </header>

        <section class="grid sm:grid-cols-3 gap-4">
          <div class="neon-card p-5 space-y-2">
            <i class="ph ph-code text-2xl text-cyan-400"></i>
            <h3 class="font-semibold text-white">x-* directives</h3>
            <p class="text-sm text-slate-400">Same conventions as Alpine.js — logic in the markup, thinner JS.</p>
          </div>
          <div class="neon-card p-5 space-y-2">
            <i class="ph ph-database text-2xl text-pink-400"></i>
            <h3 class="font-semibold text-white">$store</h3>
            <p class="text-sm text-slate-400"><code class="text-pink-300">M.store()</code> — global reactive data that survives HMR.</p>
          </div>
          <div class="neon-card p-5 space-y-2">
            <i class="ph ph-git-branch text-2xl text-purple-400"></i>
            <h3 class="font-semibold text-white">Router + HMR</h3>
            <p class="text-sm text-slate-400">Pathname routing keeps your place. Edit a file — the page updates, state stays.</p>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-xl font-semibold text-cyan-200">Hello, Alpine-style</h2>
          <pre class="code-block"><code><span class="cm">// components/card.js</span>
<span class="kw">export default</span> () => ({
  template: \`
    &lt;div x-data="{ name: '' }"&gt;
      &lt;input x-model="name" placeholder="Your name" /&gt;
      &lt;p x-text="'Hi ' + name"&gt;&lt;/p&gt;
      &lt;button @click="alert('Hi ' + name)"&gt;Alert&lt;/button&gt;
    &lt;/div&gt;
  \`,
})

<span class="cm">// or register once</span>
M.data(<span class="str">'card'</span>, () => ({ name: <span class="str">''</span> }))
<span class="cm">// &lt;div x-data="card"&gt;...&lt;/div&gt;</span></code></pre>
        </section>
      </article>
    `,
    go: Router.link,
  };
}
