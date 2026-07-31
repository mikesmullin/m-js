# m.js v3

A minimalist UI framework with **Alpine-style** `x-*` directives and an **`M.*` API**.

- **Directives** — `x-data`, `x-bind` / `:`, `x-on` / `@`, `x-text`, `x-html`, `x-model`, `x-show`, `x-if`, `x-for`, `x-init`, `x-effect`, `x-ref`, `x-cloak`, `x-ignore`, `x-transition`
- **Magics** — `$store`, `$el`, `$refs`, `$dispatch`, `$watch`, `$nextTick`
- **Methods** — `M.data()`, `M.store()`, `M.start()`, `M.mount()`, `M.redraw()`, …
- **Router** — pathname client router (supports a base path for GitHub Pages)
- **HMR** — Bun dev server + chokidar + WebSocket; named stores survive reloads

Zero runtime dependencies.

## Docs & demos

| | |
|--|--|
| Framework docs | https://mikesmullin.github.io/m-js/ |
| UI components storybook | https://mikesmullin.github.io/m-js-components/ |
| Components source | https://github.com/mikesmullin/m-js-components |

Docs are published from the orphan [`docs`](https://github.com/mikesmullin/m-js/tree/docs) branch. This `v3` branch is the framework only.

## Quick start

```bash
bun install
bun run dev
```

## Hello world

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hello</title>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import M from '/src/index.js'

    M.mount('#app', () => ({
      template: `<h1 x-text="'Hello world'"></h1>`,
    }))
  </script>
</body>
</html>
```

```js
M.data('dropdown', () => ({
  open: false,
  toggle() { this.open = !this.open },
}))

M.store('cart', { items: [], add(i) { this.items.push(i) } })
```
