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
| CDN (minified ESM) | https://mikesmullin.github.io/m-js/dist/m.min.js |
| UI components storybook | https://mikesmullin.github.io/m-js-components/ |
| Components source | https://github.com/mikesmullin/m-js-components |

Docs and the CDN bundle are published from the orphan [`docs`](https://github.com/mikesmullin/m-js/tree/docs) branch (GitHub Pages). This `v3` branch is the framework source.

## CDN (drop-in)

Any site can load the cloud-hosted build — no install step:

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
    import M, { Router } from 'https://mikesmullin.github.io/m-js/dist/m.min.js'

    M.mount('#app', () => ({
      template: `<h1 x-text="'Hello world'"></h1>`,
    }))
  </script>
</body>
</html>
```

Published files under `/dist/`:

| File | Description |
|------|-------------|
| `m.js` | All-in-one ESM bundle (not minified) |
| `m.min.js` | Minified ESM (preferred for production / CDN) |
| `m.min.js.gz` | Same bytes, gzip-compressed (size / precompressed hosting) |

## Quick start (local)

```bash
bun install
bun run dev
```

## Build & release

```bash
# Write dist/m.js, dist/m.min.js, dist/m.min.js.gz
bun run build
# or: bun build.mjs package

# Tag, GitHub Release (with assets), push dist/ + docs to the docs branch
bun run release
# or: bun build.mjs release
# or: bun build.mjs release 3.0.1
```

## Hello world (local modules)

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
