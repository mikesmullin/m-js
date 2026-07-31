# M.js

A minimalist UI framework with **Alpine-style** `x-*` directives and an **`M.*` API**.

- **Directives** — `x-data`, `x-bind` / `:`, `x-on` / `@`, `x-text`, `x-html`, `x-model`, `x-show`, `x-if`, `x-for`, `x-init`, `x-effect`, `x-ref`, `x-cloak`, `x-ignore`, `x-transition`
- **Magics** — `$store`, `$el`, `$refs`, `$dispatch`, `$watch`, `$nextTick`
- **Methods** — `M.data()`, `M.store()`, `M.start()`, `M.mount()`, `M.redraw()`, …
- **Router** — pathname client router (from m.js v2)
- **HMR** — Bun dev server + chokidar + WebSocket; named stores survive reloads

Zero runtime dependencies. Prefer putting reactivity in the markup so component JS stays thin.

## Quick start

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Component

```js
// Inline state in the template
export default () => ({
  template: `
    <div x-data="{ name: '' }">
      <input x-model="name" />
      <p x-text="'Hello ' + name"></p>
      <button @click="alert('Hi ' + name)">Save</button>
    </div>
  `,
})

// Or register a reusable data component
M.data('dropdown', () => ({
  open: false,
  toggle() { this.open = !this.open },
}))
// <div x-data="dropdown">…</div>

// Global store
M.store('cart', { items: [], add(i) { this.items.push(i) } })
// @click="$store.cart.add(product)"
```

```js
import M from './src/index.js'
import Card from './card.js'

M.mount('#app', Card)
```
