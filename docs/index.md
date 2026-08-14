# m.js v3 — Alpine parity, trade-offs & compromises

> Alpine-style `x-*` directives, `$store`, a client Router and hot reload — with keyed virtual-DOM reconciliation underneath, so a redraw that changes nothing writes nothing. The API is `M.*`.

**Version:** 3.4.0 · **CDN:** `https://mikesmullin.github.io/m-js/dist/m.min.js` · **GitHub:** [mikesmullin/m-js](https://github.com/mikesmullin/m-js) · **Storybook:** [m-js-components](https://mikesmullin.github.io/m-js-components/)

---

## Table of Contents

- [Start](#start)
  - [m.js — Minimalist UI for the modern web](#mjs)
  - [Quick start](#quick-start)
  - [The three architectures](#the-three-architectures)
- [API reference — Attributes](#api-reference--attributes)
  - [x-data](#x-data) — Full parity
  - [x-bind](#x-bind) — Partial
  - [x-on](#x-on) — Partial
  - [x-text](#x-text) — Full parity
  - [x-html](#x-html) — Trade-off
  - [x-model](#x-model) — Partial
  - [x-show](#x-show) — Full parity
  - [x-transition](#x-transition) — Partial
  - [x-for](#x-for) — Beyond Alpine
  - [x-if](#x-if) — Beyond Alpine
  - [x-init](#x-init) — Full parity
  - [x-effect](#x-effect) — Full parity
  - [x-ref](#x-ref) — Trade-off
  - [x-cloak](#x-cloak) — Full parity
  - [x-ignore](#x-ignore) — Trade-off
  - [x-component](#x-component) — Beyond Alpine
- [API reference — Properties](#api-reference--properties)
  - [$store](#store) — Full parity
  - [$el](#el) — Trade-off
  - [$dispatch](#dispatch) — Full parity
  - [$watch](#watch) — Full parity
  - [$refs](#refs) — Trade-off
  - [$nextTick](#nexttick) — Trade-off
- [API reference — Methods](#api-reference--methods)
  - [M.data](#mdata) — Full parity
  - [M.component](#mcomponent) — Beyond Alpine
  - [M.store](#mstore) — Full parity
- [Extras](#extras)
  - [Router](#router)
  - [What m.js adds](#what-mjs-adds)
  - [The complete gap list](#the-complete-gap-list)

**Status legend:**

- 🟢 **Full parity** — same syntax, same semantics
- 🔵 **Beyond Alpine** — m.js does more
- 🟡 **Trade-off** — works, but differs somewhere you should know
- 🟣 **Partial** — a subset of Alpine's surface
- 🔴 **Not implemented** — deliberately left out

---

## Start

### m.js

**Alpine-style directives on a real virtual DOM. Zero runtime dependencies.**

m.js puts behaviour next to markup — the same conventions as Alpine.js — but runs it on a virtual DOM with keyed reconciliation and LIS reordering.

| Layer | What it does |
|-------|--------------|
| **Markup — `x-*` directives** | The same conventions as Alpine.js — logic beside the markup, far less JavaScript. |
| **State — `$store`** | `M.store()` gives you global reactive data that survives a hot reload. |
| **Rendering — Virtual DOM** | Keyed reconciliation with LIS reordering. Nodes are moved and patched, never rebuilt. |

#### Hello, Alpine-style

Drop the minified ESM build onto any page — no install, no build step. Served from GitHub Pages at `https://mikesmullin.github.io/m-js/dist/m.min.js`.

**The whole thing, in one file** — a complete document that really imports the CDN bundle:

```html
<!DOCTYPE html>
<html lang="en">
<body>
  <div id="app"></div>
  <script type="module">
    import M from 'https://mikesmullin.github.io/m-js/dist/m.min.js'

    M.mount('#app', () => ({
      count: 0,
      template: `
        <button type="button" @click="count++">
          clicked <span x-text="count"></span>×
        </button>
      `,
    }))
  </script>
</body>
</html>
```

**Or enhance markup you already have** — no mount point, no component object. `M.start()` takes over whatever is already on the page:

```html
<div x-data="{ q: '', tags: ['alpha','beta','gamma'] }">
  <input x-model="q" placeholder="filter…">
  <ul>
    <li x-for="t in tags.filter(t => t.includes(q))" :key="t" x-text="t"></li>
  </ul>
</div>
```

---

### Quick start

> Two ways in: a CDN tag for production, or a dev server with hot reload.

#### 1 · Production — no build step

```html
<!DOCTYPE html>
<html>
<body>
  <div id="app"></div>
  <script type="module">
    import M from 'https://mikesmullin.github.io/m-js/dist/m.min.js'
    M.mount('#app', () => ({ template: '<h1>hi</h1>' }))
  </script>
</body>
</html>
```

One script tag, 12 KB gzipped, zero dependencies. This is the whole install for a static site. No HMR — which is exactly what you want in production anyway.

#### 1b · Or from npm

```js
bun add m-js       # or npm i m-js

import M, { Router } from 'm-js'
import { createStore } from 'm-js/store'
```

The package ships `src/` as ES modules plus the prebuilt `dist/`. Subpath exports: `m-js/m`, `m-js/router`, `m-js/store`, `m-js/hot-client`.

#### 2 · Local development with hot reload

Cloning this repo gives you a dev server with HMR already wired:

```js
bun install
bun run dev        # http://localhost:3000
```

HMR keeps your route and your `$store` data across a reload — you edit a file, the page updates, and the state you were looking at is still there.

#### Adding HMR to a server you already have

m.js's hot-reload client is not tied to the bundled dev server. It speaks a two-message protocol over one WebSocket, so any backend can drive it. Here it is on a minimal Express app.

**server.js:**

```js
import express from 'express'
import { WebSocketServer } from 'ws'
import chokidar from 'chokidar'
import path from 'node:path'

const ROOT = 'public'
const app = express()
app.use(express.static(ROOT))
const server = app.listen(3000)

// 1. the socket the client connects to — the path matters
const wss = new WebSocketServer({ server, path: '/__m_hmr' })
wss.on('connection', (ws) => ws.send(JSON.stringify({ type: 'connected' })))

// 2. tell every client which file changed
chokidar.watch(ROOT, { ignoreInitial: true }).on('all', (event, file) => {
  if (event !== 'change' && event !== 'add') return
  const rel = '/' + path.relative(ROOT, file).split(path.sep).join('/')
  const msg = JSON.stringify({ type: 'change', path: rel })
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(msg)
})
```

> `npm i express ws chokidar`. That is the entire server side — one socket at `/__m_hmr` and a `{ type: 'change', path }` message per saved file.

**public/index.html:**

```html
<div id="app"></div>

<script type="module" data-hmr-entry src="/app.js"></script>
```

**public/app.js:**

```js
import M from 'm-js'
import 'm-js/hot-client'      // connects to /__m_hmr automatically

export async function boot() {
  const { default: Home } = await import('./home.js?t=' + Date.now())
  M.mount('#app', Home)
}
window.__M_BOOT__ = boot      // HMR calls this instead of reloading
await boot()
```

> Importing `m-js/hot-client` is the whole client side. Exposing `window.__M_BOOT__` is what upgrades a full page reload into a hot swap.

#### What the client does with each message

- `.css` → the matching `<link>` href is cache-busted. No reload, no flicker.
- `.js` / `.mjs` → the module is re-imported with a cache-busting query, then `window.__M_BOOT__(t)` is called. Without that hook it falls back to re-importing the `[data-hmr-entry]` script; if that throws, it does a full reload.
- `.html` → full reload, since the document shell itself changed.
- `document.documentElement.dataset.hmr` tracks `connected` / `updating`, and an `m:hmr` event fires on `window` after each swap — handy for your own teardown.

#### Why state survives the swap

Stores live in a bucket keyed by name on `window`, so re-registering a store during a reload merges new methods but keeps the existing data. And because rendering is a diff rather than a rebuild, the DOM that did not change is not touched — scroll position, focus and input values all come through intact. See `M.store` and the architecture section.

---

### The three architectures

> Same markup vocabulary, three completely different machines underneath.

Alpine, m.js v2 and m.js v3 all put behaviour next to markup — but only two of them share a *syntax*, and only two share a *rendering strategy*. v3 is the one that takes Alpine's vocabulary and runs it on v2's virtual DOM.

| | Alpine.js | m.js v2 | m.js v3 — today |
|---|-----------|---------|-----------------|
| **Model** | Effect per binding | Hyperscript VDOM | Template → AST → VNode → diff |
| **How it works** | Every directive becomes a persistent reactive effect bound to one element. When state changes, only the effects that read it re-run and patch the DOM in place. | No directives, no reactivity at all. You write `M.html('div', attrs, …children)`, call `M.redraw()` yourself, and a keyed diff works out the minimum DOM operations. | Alpine's vocabulary, v2's engine. The template string is parsed **once** into a static AST; each redraw evaluates it against scope into VNodes and diffs those. |
| **Flow** | `state → effect → el.textContent = …` | `view() → VNodes → diff → DOM` | `template → AST (once)` → `AST + scope → VNodes` → `VNodes → diff → DOM` |

#### The one thing that changed everything

In v3.0 `M.redraw()` ran `destroyTree()` then `rootEl.innerHTML = template` — destroying and rebuilding every node, listener and binding on every pass, even when nothing changed. Directives were persistent effects, so each redraw re-executed every binding on the page. That feedback edge produced the hot loops the old 500 ms redraw throttle was papering over.

**Now a redraw with unchanged state performs zero DOM writes.**

#### Where each is evaluated

| Concern | Alpine | m.js v3 |
|---------|--------|---------|
| x-text | effect writes textContent | TextVNode; diff writes only on change |
| :class | effect mutates classList | attribute in the VNode bag |
| x-for | effect manages child list | keyed fragment + LIS reorder |
| @click | listener added once | attr with a stable identity key |
| redraw cost | n/a (no redraw) | O(tree) diff, 0 DOM writes if equal |

---

## API reference — Attributes

### x-data

> Declare a component and the state that belongs to a block of HTML.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
  <p x-show="open">Now you see me</p>
</div>
```

**m.js v2 — how you would have done it:**

```js
class Dropdown extends Component {
  oninit() { this.state = { open: false } }
  view() {
    return M.html('div', null,
      M.html('button', { onclick: () => {
        this.state.open = !this.state.open
        M.redraw()          // no reactivity — you drive it
      }}, M.text('Toggle')),
      this.state.open && M.html('p', null, M.text('Now you see me')))
  }
}
```

> v2 had no markup-level scope. State was a plain object on a Component instance and every change needed an explicit redraw.

**m.js v3:**

```html
<div x-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
  <p x-show="open">Now you see me</p>
</div>
```

> Byte-identical to Alpine.

**How it works now:**

- `x-data` compiles to a `ComponentVNode`. Its scope lives on the component *instance*, and the diff carries that instance across redraws via `_update` — the same mechanism v2 used to preserve component state.
- Nested `x-data` inherits from the parent's **raw** target, not the parent proxy. A proxy on the prototype chain would capture plain assignments to the child through its own `set` trap.
- `init()` and `destroy()` methods on the scope object are honoured.

**Why it matters:** This is the unit of encapsulation. Everything inside the element can read and write that object by bare name — no imports, no wiring, no build step. It is the single reason Alpine-style markup feels lighter than a component framework.

**Examples:**

*Local state that survives redraws:*

```html
<div x-data="{ open: false, n: 0 }">
  <button @click="open = !open; n++">Toggle</button>
  <span class="tag" x-text="'toggled ' + n + '×'"></span>
  <div class="box" x-show="open">
    Panel content. Try editing this text.
  </div>
</div>
```

*Tabs — one string drives three views:*

```html
<div x-data="{ tab: 'billing' }">
  <button @click="tab = 'billing'" :class="tab === 'billing' && 'on'">Billing</button>
  <button @click="tab = 'team'" :class="tab === 'team' && 'on'">Team</button>
  <button @click="tab = 'api'" :class="tab === 'api' && 'on'">API</button>

  <div class="box" x-show="tab === 'billing'">Card ending 4242</div>
  <div class="box" x-show="tab === 'team'">3 seats used of 5</div>
  <div class="box" x-show="tab === 'api'">Key: sk_live_…</div>
</div>
```

*Methods live on the same object:*

```html
<div x-data="{
  email: '',
  sending: false,
  sent: false,
  submit() {
    this.sending = true
    setTimeout(() => { this.sending = false; this.sent = true }, 700)
  }
}">
  <input x-model="email" placeholder="you@example.com">
  <button @click="submit()" :disabled="sending || !email">
    <span x-text="sending ? 'Sending…' : 'Sign up'"></span>
  </button>
  <div class="box on" x-show="sent">Signed up as <b x-text="email"></b></div>
</div>
```

---

### x-bind

> Set any HTML attribute from an expression. Shorthand: `:attr`.

**Status:** 🟣 Partial

**Alpine.js:**

```html
<div x-bind:class="!open ? 'hidden' : ''">…</div>
<button :disabled="busy">Save</button>
<a :href="'/user/' + id">Profile</a>

<!-- spread form: an object of attributes -->
<div x-bind="attrs"></div>
```

**m.js v2:**

```js
M.html('div', { class: open ? '' : 'hidden' })
M.html('button', { disabled: busy }, M.text('Save'))
M.html('a', { href: '/user/' + id }, M.text('Profile'))
```

> Attributes were a plain object literal — the closest thing v2 had to a binding.

**m.js v3:**

```html
<div :class="!open ? 'hidden' : ''">…</div>
<button :disabled="busy">Save</button>
<a :href="'/user/' + id">Profile</a>

<!-- NOT supported: the object spread form -->
<div x-bind="attrs"></div>
```

> Per-attribute binding is identical. The spread form is not implemented.

**Differences worth knowing:**

- **`x-bind="objectOfAttrs"` is not implemented.** m.js treats the argument-less form as `:value`. Bind attributes one at a time.
- `:class` and `:style` are **additive** — the computed value merges with the static `class`/`style` instead of replacing it. String, array and object forms all work.
- Boolean attributes render as `name="name"` when truthy and are removed when falsy.
- `value`, `checked` and `selected` are written as DOM *properties* — an attribute write does not move a control the user has already touched.
- Removal is driven by `null`/`undefined`/`false`. An empty string is a real value, so `:alt="''"` keeps the attribute.

**Why it matters:** Binding is what turns static markup into a view. Nearly every real interaction is "flip a class", "disable a button while a request is in flight", or "build a URL from an id" — each one attribute away from being declarative.

**Examples:**

*Classes and boolean attributes:*

```html
<div x-data="{ hot: false, n: 3 }">
  <button @click="hot = !hot">Toggle class</button>
  <button @click="n--" :disabled="n <= 0">Decrement</button>
  <button @click="n = 3">Reset</button>
  <div class="box" :class="{ hot: hot }">
    <code>n</code> = <b x-text="n"></b>
  </div>
</div>
```

*Object, array and string class forms:*

```html
<div x-data="{ a: true, b: false, extra: 'tag' }">
  <button @click="a = !a">a</button>
  <button @click="b = !b">b</button>

  <div class="box" :class="{ on: a, hot: b }">object form</div>
  <div class="box" :class="[a && 'on', b && 'hot']">array form</div>
  <div class="box" :class="extra">string form — merges with class="box"</div>
</div>
```

*Derived href, title and style:*

```html
<div x-data="{ id: 7, pct: 40 }">
  <button @click="id++">next user</button>
  <button @click="pct = Math.min(100, pct + 20)">+20%</button>
  <button @click="pct = 0">reset</button>

  <div class="box">
    <a :href="'/user/' + id" :title="'Open user ' + id"
       x-text="'/user/' + id"></a>
  </div>
  <div class="box" style="padding:0;overflow:hidden">
    <div :style="{ width: pct + '%', background: '#4ee2f5', height: '14px' }"></div>
  </div>
</div>
```

---

### x-on

> Listen for browser events. Shorthand: `@event`.

**Status:** 🟣 Partial

**Alpine.js:**

```html
<button x-on:click="open = !open">Toggle</button>
<button @click.prevent.stop="save()">Save</button>
<input @keydown.enter="submit()">
<div @click.outside="close()">…</div>
<div @resize.window="measure()"></div>
```

**m.js v2:**

```js
M.html('button', {
  onclick: (e) => { e.preventDefault(); save() }
}, M.text('Save'))
```

> Handlers were plain on* properties. `_patchAttr` compared `String(fn)` to decide whether to rebind — that comparison still does the same job in v3.

**m.js v3:**

```html
<button @click="open = !open">Toggle</button>
<button @click.prevent.stop="save()">Save</button>
<input @keydown.enter="submit()">
<div @click.outside="close()">…</div>
<div @resize.window="measure()"></div>
<div @window.resize="measure()"></div>  <!-- also accepted -->
```

> Same syntax, most modifiers, plus a reversed @window.resize spelling.

**Modifier coverage:**

- **Implemented:** `.prevent .stop .self .once .capture .passive .window .document .outside`, `.ctrl .shift .alt .meta`, and keys `.enter .escape .space .tab .up .down .left .right .delete`.
- **Not implemented:** `.debounce .throttle .camel .dot .away`.
- Handlers get a stable `toString()` key from the directive source, so the diff keeps the *live* listener and only refreshes its captured scope. Nothing is unbound and rebound each frame.
- Two listeners for the same event on one element are kept apart by encoding the modifiers into the attribute key.
- `.window`/`.document`/`.outside` listeners are tracked on the VNode and unregistered when the element is removed.

**Why it matters:** Events are the other half of the loop. Writing the handler where the button is — rather than in a separate file behind a selector — is most of what makes this style productive.

**Examples:**

*Key aliases:*

```html
<div x-data="{ log: [], q: '' }">
  <input x-model="q" placeholder="type, then Enter or Esc"
         @keydown.enter="log.push('enter: ' + q)"
         @keydown.escape="q = ''; log.push('escape → cleared')">
  <div class="box">
    <div x-show="log.length === 0">No boilerplate key comparisons needed.</div>
    <div x-for="l in log" x-text="l"></div>
  </div>
</div>
```

*.prevent / .stop / .self:*

```html
<div x-data="{ outer: 0, inner: 0, selfOnly: 0 }">
  <div class="box" @click="outer++" style="cursor:pointer">
    outer — counts any click that reaches it
    <button @click.stop="inner++">inner (.stop)</button>
  </div>
  <div class="box" @click.self="selfOnly++" style="cursor:pointer">
    .self — only counts clicks on THIS box
    <button>not me</button>
  </div>
  <div class="box">
    outer <b x-text="outer"></b> ·
    inner <b x-text="inner"></b> ·
    self <b x-text="selfOnly"></b>
  </div>
</div>
```

*.outside — dismiss a menu:*

```html
<div x-data="{ open: false, closes: 0 }">
  <div @click.outside="if (open) { open = false; closes++ }">
    <button @click="open = !open">Menu</button>
    <div class="box" x-show="open">
      <div>Profile</div><div>Settings</div><div>Sign out</div>
    </div>
  </div>
  <div class="box">Open it, then click anywhere outside.
  Dismissed <b x-text="closes"></b>×</div>
</div>
```

---

### x-text

> Set the text content of an element from an expression.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div>
  Copyright ©
  <span x-text="new Date().getFullYear()"></span>
</div>
```

**m.js v2:**

```js
M.html('div', null,
  M.text('Copyright © '),
  M.text(String(new Date().getFullYear())))
```

> `TextVNode` already guarded `this._text !== old._text` before writing — that guard is untouched in v3.

**m.js v3:**

```html
<div>
  Copyright ©
  <span x-text="new Date().getFullYear()"></span>
</div>
```

> Identical. Static children of the element are replaced by the computed text.

**Under the hood:**

- Becomes a single `TextVNode` child. The diff compares the string and only assigns `textContent` when it differs — a redraw with unchanged state touches nothing.
- `null` and `false` render as an empty string, matching Alpine.

**Why it matters:** The safest way to put data on the page. Unlike interpolation into HTML it cannot inject markup, so it is the right default for anything derived from user input or an API.

**Examples:**

*Live mirror of an input:*

```html
<div x-data="{ name: '' }">
  <input x-model="name" placeholder="your name">
  <p class="box">Hello, <b x-text="name || 'stranger'"></b> —
  that is <span x-text="name.length"></span> characters.</p>
</div>
```

*Formatting stays in the template:*

```html
<div x-data="{ total: 1234.5, items: ['a','b','c'] }">
  <button @click="total = total * 1.1">+10%</button>
  <button @click="items.push('x' + items.length)">add item</button>
  <div class="box">
    <div x-text="new Intl.NumberFormat('en-US',
      { style: 'currency', currency: 'USD' }).format(total)"></div>
    <div x-text="items.length + (items.length === 1 ? ' item' : ' items')"></div>
    <div x-text="items.join(', ')"></div>
  </div>
</div>
```

---

### x-html

> Set the inner HTML of an element from an expression.

**Status:** 🟡 Trade-off

**Alpine.js:**

```html
<div x-html="(await axios.get('/some/html/partial')).data">
  …
</div>
```

**m.js v2:**

```js
// no equivalent — you would build VNodes,
// or reach for the DOM directly in oncreate()
```

> v2 had no raw-HTML escape hatch. Everything went through VNodes.

**m.js v3:**

```html
<!-- works, but the expression is NOT awaited -->
<div x-html="partial"></div>

<!-- fetch in a handler, assign to state -->
<div x-data="{ partial: '' }"
     x-init="fetch('/partial').then(r => r.text())
             .then(t => partial = t)">
  <div x-html="partial"></div>
</div>
```

> Same directive, but expressions are synchronous — do the await yourself.

**Two real differences:**

- **No implicit `await`.** Alpine evaluates directive expressions as async functions. m.js v3 compiles them to plain synchronous functions — fetch in `x-init` or a handler and assign to state.
- The element becomes a `RawHTMLVNode`: the diff **never descends into it**, and `innerHTML` is only rewritten when the string changes.
- Directives inside the injected HTML are **not** processed — inert content, same as Alpine.
- **Never pass user input.** This is an XSS sink by definition; use `x-text` unless you control the source.

**Why it matters:** The escape hatch for content that is already HTML — a server-rendered partial, rendered markdown, a sanitised rich-text field. Without it you would be building a parser or dropping to imperative DOM code.

**Examples:**

*x-html vs x-text — the security argument:*

```html
<div x-data="{ raw: '<b>bold</b> and <i>italic</i>' }">
  <button @click="raw = '<span class=\'tag\'>swapped!</span>'">Change</button>
  <button @click="raw = '<img src=x onerror=\'document.body.style.background=&quot;#fee&quot;\'>'">
    Hostile input
  </button>
  <div class="box"><b>x-html:</b> <span x-html="raw"></span></div>
  <div class="box"><b>x-text:</b> <span x-text="raw"></span></div>
</div>
```

*Async content, done properly:*

```html
<div x-data="{ body: '', loading: false,
  load() {
    this.loading = true
    setTimeout(() => {
      this.body = '<h4>Loaded partial</h4><p>Rendered as real markup.</p>'
      this.loading = false
    }, 600)
  }
}">
  <button @click="load()" :disabled="loading">
    <span x-text="loading ? 'Loading…' : 'Fetch partial'"></span>
  </button>
  <div class="box" x-html="body || '<i>nothing yet</i>'"></div>
</div>
```

---

### x-model

> Keep a piece of state and an input element in sync, both ways.

**Status:** 🟣 Partial

**Alpine.js:**

```html
<div x-data="{ search: '' }">
  <input type="text" x-model="search">
  Searching for: <span x-text="search"></span>
</div>
```

**m.js v2:**

```js
M.html('input', {
  value: state.search,
  oninput: (e) => {
    state.search = e.target.value
    M.redraw()
  }
})
```

> Two-way binding was manual, and v2 wrote `value` as an attribute — which does not move a control the user has typed into.

**m.js v3:**

```html
<div x-data="{ search: '' }">
  <input type="text" x-model="search">
  Searching for: <span x-text="search"></span>
</div>

<input x-model.number="qty">
<input x-model.trim="username">
<select x-model.lazy="country">
```

> Same syntax. Modifiers .lazy .number .trim are implemented.

**Coverage and the caret problem:**

- **Implemented:** `.lazy`, `.number`, `.trim`. Works on text inputs, textareas, checkboxes, radios and selects, and through dotted paths.
- **Not implemented:** `.debounce .throttle .fill .boolean`.
- `value` and `checked` are written as DOM **properties**, guarded by an inequality check. This is the difference between a redraw mid-typing being invisible and it resetting your caret to the end of the field.
- Because the diff never rebuilds an unchanged input, focus and selection survive unrelated state changes for free. Under v3.0's innerHTML rebuild this needed an explicit save/restore hack.

**Why it matters:** Forms are most of the web. Two-way binding collapses the read-render-listen-write cycle into one attribute, and the property-write detail is what makes it feel native rather than janky.

**Examples:**

*A whole form object:*

```html
<div x-data="{ form: { name: '', qty: 1, ok: false } }">
  <input x-model="form.name" placeholder="name">
  <input type="number" x-model.number="form.qty" style="width:70px">
  <label><input type="checkbox" x-model="form.ok"> agree</label>
  <pre class="box" x-text="JSON.stringify(form, null, 2)"></pre>
</div>
```

*Modifiers side by side:*

```html
<div x-data="{ plain: '', trimmed: '', num: 0, lazy: 'b' }">
  <div class="box">
    <div><input x-model="plain" placeholder="plain">
      → <code x-text="JSON.stringify(plain)"></code></div>
    <div><input x-model.trim="trimmed" placeholder="  .trim  ">
      → <code x-text="JSON.stringify(trimmed)"></code></div>
    <div><input type="number" x-model.number="num" style="width:70px">
      → <code x-text="typeof num + ' ' + num"></code></div>
    <div><select x-model.lazy="lazy">
        <option value="a">alpha</option><option value="b">beta</option>
      </select> → <code x-text="lazy"></code></div>
  </div>
</div>
```

*Checkbox group:*

```html
<div x-data="{ perms: { read: true, write: false, admin: false } }">
  <div class="box">
    <label><input type="checkbox" x-model="perms.read"> read</label><br>
    <label><input type="checkbox" x-model="perms.write"> write</label><br>
    <label><input type="checkbox" x-model="perms.admin"> admin</label>
  </div>
  <div class="box on"
    x-text="Object.keys(perms).filter(k => perms[k]).join(', ') || 'no permissions'"></div>
</div>
```

---

### x-show

> Toggle visibility with CSS. The element stays in the DOM.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-show="open">
  …
</div>
```

**m.js v2:**

```js
M.html('div', { style: open ? '' : 'display:none' })
```

> Exactly what v3 computes — v3 just derives the style for you.

**m.js v3:**

```html
<div x-show="open">
  …
</div>
```

> Identical, and it merges with any static style on the element.

**x-show vs x-if:**

- `x-show` keeps the element mounted and sets `display:none`. Scroll position, focus, form values, iframe and video state all survive being hidden.
- `x-if` removes it from the tree entirely. Cheaper when hidden, but all that state is gone.
- Rule of thumb: **x-show for things toggled often**, **x-if for things usually absent** or expensive to keep alive.
- The computed `display:none` merges into the style attribute rather than replacing it.

**Why it matters:** Cheap toggling without losing anything. A hidden panel that keeps its scroll offset and its half-filled form is the difference between a UI that feels solid and one that resets under you.

**Examples:**

*State survives hiding:*

```html
<div x-data="{ open: true }">
  <button @click="open = !open">Toggle panel</button>
  <div class="box" x-show="open" style="max-height:110px;overflow:auto">
    <input placeholder="type something here">
    <p>Scroll me down…</p><p>…then hide…</p><p>…and show again.</p>
    <p>line five</p><p>line six</p><p>line seven</p>
  </div>
</div>
```

*x-show vs x-if, side by side:*

```html
<div x-data="{ open: true }">
  <button @click="open = !open">Toggle both</button>
  <div class="box">
    <b>x-show</b> — stays mounted
    <div x-show="open"><input placeholder="I keep my value"></div>
  </div>
  <div class="box">
    <b>x-if</b> — removed from the DOM
    <div x-if="open"><input placeholder="I get rebuilt"></div>
  </div>
</div>
```

---

### x-transition

> Animate an element in and out with CSS transitions.

**Status:** 🟣 Partial

**Alpine.js:**

```html
<div x-show="open" x-transition>…</div>

<!-- full staged API -->
<div x-show="open"
  x-transition:enter="transition ease-out duration-300"
  x-transition:enter-start="opacity-0 scale-90"
  x-transition:enter-end="opacity-100 scale-100"
  x-transition:leave="transition ease-in duration-200"
  x-transition:leave-start="opacity-100"
  x-transition:leave-end="opacity-0">…</div>

<template x-if="open"><div x-transition>…</div></template>
```

**m.js v2:**

```js
// not supported
```

> v2 had no transition concept. `_delete` removed nodes synchronously.

**m.js v3:**

```html
<!-- supported: x-show only -->
<div x-show="open" x-transition>…</div>
<div x-show="open" x-transition.duration.500ms>…</div>

<!-- NOT supported -->
<div x-transition:enter="…" x-transition:leave="…">
<template x-if="open"><div x-transition>…</div></template>
```

> A declarative opacity + visibility fade on x-show. Everything else is out.

**Deliberately left out — and why:**

- **x-if leave transitions are not implemented.** A leave transition needs the node to stay in the DOM *after* it is logically gone. v2's `_delete` removes synchronously and `onbeforeremove()` is a no-op stub. Supporting it means teaching the diff deferred removal: `_delete` returning a promise, the delete pass holding the node, and a "leaving" mark so an intervening redraw neither re-diffs nor re-inserts it. Genuine new design, not a port — so it was scoped out rather than half-built.
- **The staged class API** is not implemented. It needs imperative multi-frame choreography (set class, force reflow, set next class) which cannot be expressed as a single declarative render.
- **What works:** `x-show` + `x-transition` hides with `opacity:0; visibility:hidden` and a delayed visibility transition, because `display` cannot be transitioned. `.duration.<ms>` is honoured; default 150 ms.

**Why it matters:** Motion communicates causality — a panel that fades in reads as "this appeared because you clicked", where an instant swap reads as a glitch. The x-show case covers most of that.

**Examples:**

*Fade, with duration:*

```html
<div x-data="{ a: true, b: true }">
  <button @click="a = !a">fast (150ms default)</button>
  <button @click="b = !b">slow (900ms)</button>
  <div class="box" x-show="a" x-transition>default fade</div>
  <div class="box on" x-show="b" x-transition.duration.900ms>slow fade</div>
</div>
```

*The workaround for the x-if case:*

```html
<div x-data="{ open: false }">
  <style>
    .slide { transition: transform .35s ease, opacity .35s ease;
             transform: translateY(-8px); opacity: 0 }
    .slide.in { transform: none; opacity: 1 }
  </style>
  <button @click="open = !open">Slide in</button>
  <div class="box slide" :class="{ in: open }">
    Animated via a bound class, not x-transition.
  </div>
</div>
```

---

### x-for

> Repeat a block of HTML for each item in a collection.

**Status:** 🔵 Beyond Alpine

**Alpine.js:**

```html
<template x-for="post in posts" :key="post.id">
  <h2 x-text="post.title"></h2>
</template>
```

**m.js v2:**

```js
M.volatile({
  [post.id]: M.html('h2', null, M.text(post.title)),
  // …one entry per row, keyed
})
```

> The ancestor of the whole feature. v2's keyed sibling map plus LIS reorder is what x-for compiles to in v3 — the same code, reached from markup instead of hyperscript.

**m.js v3:**

```html
<!-- on a template, like Alpine -->
<template x-for="post in posts" :key="post.id">
  <h2 x-text="post.title"></h2>
</template>

<!-- or directly on the repeated element -->
<li class="row" x-for="post in posts" :key="post.id"
    x-text="post.title"></li>

<!-- objects, ranges, any iterable -->
<div x-for="(value, key) in settings"></div>
<div x-for="i in 5"></div>
```

> Alpine syntax, plus a bare-element form and a wider range of iterables.

**The centrepiece of the port:**

- Each row becomes a keyed sibling in a `volatile()` fragment. The diff computes a **longest increasing subsequence** over the old→new index map, so a maximal stable run of rows never moves — reversing 20 items performs 19 moves, not 40 create/destroys.
- Row identity is real: reorder a list and the DOM nodes are the *same objects*, carrying scroll, focus and input state with them.
- Iterables: arrays, plain objects (`(value, key) in obj`), integers (`i in 5`), anything with `Symbol.iterator`. `$index` is always available.
- The row scope is a **delegating Proxy**, not a prototype chain: locals shadow the parent, everything else forwards to the parent proxy. An inherited method called from a row is already bound to the store, so `this.items = …` mutates the store — while writing a local cannot leak upward.
- Duplicate keys are disambiguated and warned about rather than silently collapsing rows.

**Why it matters:** Lists are where naive rendering falls apart. Without keyed reconciliation, editing one row of a table rebuilds every row — losing focus, scroll and selection, and burning frames. This is the single most valuable thing the virtual DOM buys you.

**Examples:**

*Reorder keeps node identity:*

```html
<div x-data="{
  items: [{id:1,t:'alpha'},{id:2,t:'beta'},{id:3,t:'gamma'}],
  rotate() { this.items = [...this.items.slice(-1), ...this.items.slice(0, -1)] },
  drop(id) { this.items = this.items.filter(i => i.id !== id) },
  add() { const n = Date.now() % 1000
          this.items.push({ id: n, t: 'new ' + n }) }
}">
  <button @click="rotate()">Reorder</button>
  <button @click="add()">Add</button>
  <ul>
    <li x-for="it in items" :key="it.id">
      <b x-text="it.t"></b>
      <input placeholder="type here…" style="width:110px">
      <button @click="drop(it.id)">×</button>
    </li>
  </ul>
</div>
```

*Keyed vs unkeyed:*

```html
<div x-data="{
  items: [{id:1,t:'alpha'},{id:2,t:'beta'},{id:3,t:'gamma'}],
  rotate() { this.items = [...this.items.slice(-1), ...this.items.slice(0, -1)] }
}">
  <button @click="rotate()">Reorder</button>
  <p><b>Keyed</b> — :key="it.id"</p>
  <ul><li x-for="it in items" :key="it.id">
    <b x-text="it.t"></b> <input style="width:90px">
  </li></ul>
  <p><b>Unkeyed</b> — falls back to index</p>
  <ul><li x-for="it in items">
    <b x-text="it.t"></b> <input style="width:90px">
  </li></ul>
</div>
```

*Objects, ranges and $index:*

```html
<div x-data="{
  list: ['red','green','blue'],
  meta: { region: 'eu-west', tier: 'pro' },
  n: 4
}">
  <button @click="n = n % 8 + 1">range = <b x-text="n"></b></button>
  <div class="box">
    <div x-for="(c, i) in list" x-text="(i + 1) + '. ' + c"></div>
  </div>
  <div class="box">
    <div x-for="(v, k) in meta"><b x-text="k"></b>: <span x-text="v"></span></div>
  </div>
  <div class="box">
    <span class="tag" x-for="i in n" x-text="i" style="margin-right:4px"></span>
  </div>
</div>
```

---

### x-if

> Add or remove a block of HTML from the page entirely.

**Status:** 🔵 Beyond Alpine

**Alpine.js:**

```html
<!-- Alpine REQUIRES a template wrapper -->
<template x-if="open">
  <div>…</div>
</template>
```

**m.js v2:**

```js
// return a falsy vnode, or use the helper
open && M.html('div', null, …)
M.wrapIf(open, (kids) => M.html('div', null, kids), kids)
```

> `_isFalsy` dropping a sibling is still exactly how v3 removes an x-if branch.

**m.js v3:**

```html
<!-- template form works -->
<template x-if="open">
  <div>…</div>
</template>

<!-- and so does the bare element form -->
<div x-if="open">…</div>
```

> Both forms. The bare-element form is not available in Alpine.

**Why toggling one branch does not disturb its neighbours:**

- Children are keyed by their position in the **AST**, not in the rendered output. An `x-if` that renders nothing leaves a hole rather than shifting every later sibling's key.
- Without that, toggling a conditional would renumber its siblings and each would look like a different element at its index. This was a real bug during the port: a `<div x-if>` appearing in a slot previously held by a `<button>` was created but never inserted, because the changed node still counted toward the stable subsequence.
- The `<template>` form renders its children with no wrapper element, so you can conditionally emit several siblings at once.

**Why it matters:** For content usually absent — modals, empty states, admin-only controls — keeping it mounted and hidden wastes memory and can leak behaviour (hidden form fields still submit, hidden iframes still load). x-if makes absence real.

**Examples:**

*Siblings keep their state:*

```html
<div x-data="{ show: false }">
  <button @click="show = !show">Toggle branch</button>
  <div class="box"><input placeholder="type here first"></div>
  <div x-if="show" class="box on">I was just added to the DOM.</div>
  <div class="box">…and this one never moved.</div>
</div>
```

*template x-if — several siblings, no wrapper:*

```html
<div x-data="{ admin: false }">
  <label><input type="checkbox" x-model="admin"> admin mode</label>
  <div class="box">
    <button>View</button>
    <template x-if="admin">
      <button>Edit</button>
      <button>Delete</button>
    </template>
  </div>
</div>
```

---

### x-init

> Run code once, when the element is first created.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-init="date = new Date()"></div>
<div x-data="{ posts: [] }"
     x-init="posts = await (await fetch('/api')).json()">
</div>
```

**m.js v2:**

```js
class Widget extends Component {
  oninit()   { /* before first view() */ }
  oncreate() { /* after DOM exists */ }
}
```

> v2 queued `oncreate` into `_delayedLifecycleEvents` and drained it after the diff committed. v3 uses the same queue.

**m.js v3:**

```html
<div x-init="date = new Date()"></div>

<!-- no implicit await — use .then or an async IIFE -->
<div x-data="{ posts: [] }"
     x-init="fetch('/api').then(r => r.json())
             .then(p => posts = p)">
</div>
```

> Same directive and timing. Alpine's implicit await is not available.

**Timing guarantees:**

- Runs from the **deferred lifecycle queue** — pushed during the diff, drained only after the whole tree is committed. Your code can never observe a half-updated DOM, and calling `M.redraw()` here cannot re-enter the diff.
- `$el` and `$refs` **are** correct here, unlike in build-time expressions such as `x-text`. This is the right place to hand an element to a third-party library.
- No implicit `await`: use `.then()` or `(async () => { … })()`.

**Why it matters:** The bridge to everything that is not m.js — chart libraries, date pickers, maps, IntersectionObservers. Also where you register `$watch` and kick off the fetch that fills the component.

**Examples:**

*$el and $refs are usable here:*

```html
<div x-data="{ at: '', tag: '', refVal: '' }"
     x-init="at = new Date().toLocaleTimeString();
             tag = $el.tagName;
             refVal = $refs.probe.value">
  <input x-ref="probe" value="read from a ref">
  <div class="box">
    ran at <b x-text="at"></b><br>
    <code>$el</code> → <b x-text="tag"></b><br>
    <code>$refs.probe.value</code> → <b x-text="refVal"></b>
  </div>
</div>
```

*Load data on mount:*

```html
<div x-data="{ rows: [], loading: true }"
     x-init="setTimeout(() => {
       rows = [{id:1,n:'ada'},{id:2,n:'grace'},{id:3,n:'linus'}]
       loading = false
     }, 700)">
  <div class="box" x-show="loading">Loading…</div>
  <ul x-show="!loading">
    <li x-for="r in rows" :key="r.id" x-text="r.n"></li>
  </ul>
</div>
```

---

### x-effect

> Re-run a snippet whenever any state it reads changes.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-effect="console.log('Count is ' + count)"></div>
```

**m.js v2:**

```js
// no equivalent — v2 had no reactivity at all
```

> The one Alpine idea with no v2 ancestor whatsoever.

**m.js v3:**

```html
<div x-effect="console.log('Count is ' + count)"></div>
```

> Identical — and one of the few places the reactive core is still load-bearing.

**Why the reactive core survived the port:**

- DOM patching no longer goes through effects — that is the diff's job. But `x-effect`, `$watch` and store subscriptions genuinely need **fine-grained dependency tracking**, so the proxy/track/trigger core stays.
- Dependencies are collected on each run, exactly like Alpine: read `count` and you are subscribed to `count`.
- **Careful:** an effect that writes something it also reads is self-triggering and will loop. Push to a non-reactive sink, or read and write different things. Identical hazard in Alpine.
- The effect is torn down when its element is removed, and its captured scope is refreshed on every redraw so it never sees stale state.

**Why it matters:** Side effects that are not rendering: persisting to localStorage, updating document.title, firing analytics, syncing a canvas. Without it you would write `$watch` calls for every dependency by hand.

**Examples:**

*Runs on mount, then on every change:*

```html
<div x-data="{ n: 0, last: '—' }"
     x-effect="last = 'effect saw n=' + n + ' at '
               + new Date().toLocaleTimeString()">
  <button @click="n++">Increment</button>
  <div class="box"><b x-text="last"></b></div>
</div>
```

*Tracks every value it reads:*

```html
<div x-data="{ theme: 'dark', density: 'cosy', saved: '' }"
     x-effect="saved = JSON.stringify({ theme, density })">
  <select x-model="theme">
    <option>dark</option><option>light</option>
  </select>
  <select x-model="density">
    <option>cosy</option><option>compact</option>
  </select>
  <div class="box">would persist: <code x-text="saved"></code></div>
</div>
```

*The self-triggering trap:*

```html
<script>
  // runs is a plain closure variable — not reactive, so the effect
  // cannot subscribe to it. That is what makes this safe.
  let runs = 0
  M.data('probe', () => ({
    n: 0,
    last: '—',
    record(v) { runs++; this.last = 'run #' + runs + ' — saw n=' + v }
  }))
</script>

<div x-data="probe" x-effect="record(n)">
  <button @click="n++">increment n</button>
  <div class="box">last: <b x-text="last"></b></div>
  <div class="box">
    The effect READS <code>n</code> and WRITES <code>last</code> — different
    keys, so it never retriggers itself.
  </div>
</div>
```

---

### x-ref

> Give an element a name so you can reach it via `$refs`.

**Status:** 🟡 Trade-off

**Alpine.js:**

```html
<input type="text" x-ref="content">

<button x-on:click="navigator.clipboard
        .writeText($refs.content.value)">
  Copy
</button>
```

**m.js v2:**

```js
// vnode.dom after _create() — you held the VNode
const input = HTMLElementVNode.factory('input', …)
// later: input.dom.value
```

> v2 exposed the real node on the VNode itself. No naming layer was needed because you already had the object.

**m.js v3:**

```html
<input type="text" x-ref="content">

<button @click="navigator.clipboard
        .writeText($refs.content.value)">
  Copy
</button>
```

> Same syntax — but refs register at create time, so they are not available during the first build pass.

**The timing trade-off:**

- Refs are populated in the element's **create** hook. During the first build pass no DOM exists yet, so `$refs` is empty in build-time expressions like `x-text` or `:attr`.
- **Safe places to read `$refs`:** event handlers, `x-init`, `x-effect`, and inside `$nextTick`.
- **Will not work:** `<span x-text="$refs.box.value">` on the first render. A consequence of evaluating directives during tree construction rather than against live DOM.
- Refs are scoped to the enclosing `x-data` component, matching Alpine.

**Why it matters:** Sometimes you genuinely need the element — to focus it, measure it, read a file input, or hand it to a library. x-ref gives you that without a querySelector and without a global id.

**Examples:**

*Read, focus, measure:*

```html
<div x-data="{ out: '', size: '' }">
  <input x-ref="box" value="hello refs">
  <button @click="out = $refs.box.value.toUpperCase()">Read</button>
  <button @click="$refs.box.focus(); $refs.box.select()">Focus + select</button>
  <button @click="size = Math.round($refs.box.getBoundingClientRect().width) + 'px'">Measure</button>
  <div class="box">
    read: <b x-text="out || '—'"></b><br>
    width: <b x-text="size || '—'"></b>
  </div>
</div>
```

*The timing caveat, demonstrated:*

```html
<div x-data="{ pulled: '' }">
  <input x-ref="src" value="I am a ref">
  <div class="box">
    from <code>x-text</code> (build-time):
    <b x-text="$refs.src ? $refs.src.value : '(empty on first pass)'"></b>
  </div>
  <button @click="pulled = $refs.src.value">read from a handler</button>
  <div class="box on">from a handler: <b x-text="pulled || '—'"></b></div>
</div>
```

---

### x-cloak

> Hide markup until the framework has finished initialising it.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-cloak>
  …
</div>

<style>[x-cloak] { display: none }</style>
```

**m.js v2:**

```js
// not needed — v2 built the tree before inserting it,
// so unrendered markup was never on screen
```

> A VDOM has no flash-of-unstyled-content problem by construction.

**m.js v3:**

```html
<div x-cloak>
  …
</div>

<!-- the CSS rule is injected for you -->
```

> Accepted and stripped, and the style rule is still injected — but largely vestigial.

**Mostly obsolete, kept for compatibility:**

- The problem `x-cloak` solves is a flash of raw template markup before the framework boots. Under `M.mount()` the VNode tree is **built before it is inserted**, so there is no window in which unprocessed markup is visible.
- It still matters for the progressive-enhancement path (`M.start()` / `initTree()` over server-rendered HTML), where the original markup *is* on screen before m.js takes over.
- m.js injects `[x-cloak],[m-cloak]{display:none !important}` into the document head automatically.

**Why it matters:** The difference between a page that renders cleanly and one that flashes raw template guts for 200ms on a slow connection. Less relevant here than in Alpine, but free to keep.

**Example:**

```html
<div x-data="{ n: 1 }" x-cloak class="box">
  <button @click="n++">n = <span x-text="n"></span></button>
  <p style="font-size:12px;color:#64748b">
    This element was written with <code>x-cloak</code>.
    It has already been removed from the rendered node.
  </p>
</div>
```

---

### x-ignore

> Tell the framework to leave a subtree alone.

**Status:** 🟡 Trade-off

**Alpine.js:**

```html
<div x-ignore>
  …
</div>
```

**m.js v2:**

```js
class Embed extends Component {
  onbeforeupdate() { return false }  // freeze the subtree
}
```

> v2 already had the exact mechanism — a component could refuse to update. v3's ComponentVNode still honours `onbeforeupdate() === false`.

**m.js v3:**

```html
<div x-ignore>
  …
</div>
```

> Same syntax, but implemented by capturing the markup, not by skipping a walk.

**A different mechanism than Alpine's:**

- Alpine simply *skips* the subtree when walking the DOM — whatever is there stays, untouched.
- m.js v3 captures the subtree's markup at **parse time** and renders it as an opaque `RawHTMLVNode`. Directives inside are never processed and the diff never descends into it.
- **The consequence:** the content is reproduced from the captured string. Mutations made by outside code survive as long as the node is not recreated, but they are not part of the captured markup.
- For a widget that must own its DOM permanently, prefer wrapping it in its own `x-data` component and returning `false` from a lifecycle guard.

**Why it matters:** Third-party scripts assume they own their patch of DOM. Without an opt-out, your reconciler and their jQuery plugin will fight over the same nodes, and the plugin will lose in ways that are very hard to debug.

**Example:**

```html
<div x-data="{ n: 0 }">
  <button @click="n++">n = <span x-text="n"></span></button>
  <div class="box" x-ignore>
    inside x-ignore: <span x-text="n">never processed</span>
    <button @click="n = 999">this button does nothing</button>
  </div>
  <div class="box on">outside: <span x-text="n"></span></div>
</div>
```

---

### x-component

> Invoke a registered widget by name. The callee owns the markup; the host only passes props.

**Status:** 🔵 Beyond Alpine

**Alpine.js:**

```html
<!-- Alpine has no equivalent. x-data injects a scope;
the caller still types the HTML every time. -->
<div x-data="dropdown">
  <button @click="toggle()">…</button>
</div>
```

**m.js v2:**

```js
m(Button, { color: 'primary', label: 'Send', onclick: send })
m(PriorityIcon, { priority: c.priority })
```

> v2 composition is one call. v3's x-data cannot do that — it has no template of its own. x-component restores the call form inside a template string.

**m.js v3:**

```html
<span x-component="prio" :priority="c.priority"></span>
<span x-component="uiButton" variant="primary" @click="send()">Send</span>
```

> Props are evaluated in the *parent* scope — including x-for row locals — then patched onto the instance. The host element is replaced by the widget's template root.

**How it is different from x-data and x-mount:**

- `x-data` is a **scope**. The markup stays at the call site. Nested `x-data` inside `x-for` cannot see row locals.
- `x-mount` nests a `{ template, … }` object already held in state. It is the right tool for page-sized children (`Shell → page`). A new object identity remounts.
- `x-component="name"` looks the name up in `M.component`. The widget owns its template. Bound attrs (`:priority="c.priority"`) are evaluated against the parent — that is how a list row can pass `c` without the x-for hole.
- The host is **replaced** by the widget root (no wrapper). Leftover host attrs, `:class`, `x-show` and `@click` are forwarded onto that root. Host children fill a `<slot>`.
- Declare `props: ['priority']` so only those names become instance fields. Everything else on the host is forwarded. An empty static attribute (`disabled`) becomes `true`.
- The instance is a `ComponentVNode` keyed by AST position / `:key`. Updating a prop does not remount; `init()` runs once.
- `m-component` is an alias.

**Why it matters:** A component library is a function of attrs → view. Without a call form, every compound widget re-types the primitive HTML and improvements never inherit. This is the Alpine-shaped spelling of v2's `m(Name, attrs)`.

**Examples:**

*One definition, many call sites:*

```html
<script>
  const META = {
    p1: { short: 'P1', color: '#ef4444' },
    p2: { short: 'P2', color: '#f97316' },
    p3: { short: 'P3', color: '#eab308' },
  }
  M.component('prio', {
    props: ['priority'],
    priority: 'p3',
    get meta() { return META[this.priority] || META.p3 },
    template: `<span class="tag" :style="'outline-color:'+meta.color" x-text="meta.short"></span>`
  })
</script>

<div x-data="{ items: [
  {id:1, priority:'p1', title:'checkout'},
  {id:2, priority:'p2', title:'webhooks'},
  {id:3, priority:'p3', title:'replica lag'}
]}">
  <div class="box" x-for="c in items" :key="c.id">
    <span x-component="prio" :priority="c.priority"></span>
    <span x-text="c.title"></span>
  </div>
</div>
```

*Slots + host events — a reusable button:*

```html
<script>
  M.component('uiButton', {
    props: ['variant', 'disabled', 'label'],
    variant: '',
    disabled: false,
    label: '',
    template: `<button type="button" class="btn" :class="variant" :disabled="disabled">
      <span x-show="label" x-text="label"></span>
      <slot></slot>
    </button>`
  })
</script>

<div x-data="{ n: 0, busy: false }">
  <span x-component="uiButton" variant="primary" @click="n++">clicked <span x-text="n"></span>×</span>
  <span x-component="uiButton" :disabled="busy" @click="busy = !busy">
    <span x-text="busy ? 'Busy…' : 'Toggle busy'"></span>
  </span>
</div>
```

---

## API reference — Properties

### $store

> Read global reactive state from any expression.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<h1 x-text="$store.site.title"></h1>

Alpine.store('site', { title: 'Hello' })
```

**m.js v2:**

```js
// module-level object + manual redraw
export const site = { title: 'Hello' }
site.title = 'Changed'; M.redraw()
```

> No reactivity meant no store abstraction — just variables and discipline.

**m.js v3:**

```html
<h1 x-text="$store.site.title"></h1>

M.store('site', { title: 'Hello' })
```

> Identical, plus an HMR-safe bucket so a hot reload does not reset your data.

**Notes:**

- Backed by the same reactive proxy as component scope — writing `$store.cart.qty = 3` from anywhere schedules exactly one coalesced redraw.
- Stores live in an HMR-safe bucket on `window`, so editing a file keeps the data. Re-registering an existing store **merges new methods but preserves existing data**.
- `M.store(name)` reads; with a value it defines. An `init()` method on the store is called once.

**Why it matters:** Cross-component state without prop drilling or an event bus. A cart badge in the header and an "add to cart" button three components deep can share one object with no wiring between them.

**Examples:**

*Four components, zero wiring:*

```html
<script>
  M.store('cart', {
    items: [],
    add(x) { this.items.push(x) },
    clear() { this.items = [] }
  })
</script>

<div class="box"><b>Header</b> —
  cart <span class="tag" x-text="$store.cart.items.length"></span>
</div>
<div class="box"><b>Product A</b>
  <button @click="$store.cart.add('widget')">add widget</button>
</div>
<div class="box"><b>Product B</b>
  <button @click="$store.cart.add('gadget')">add gadget</button>
  <button @click="$store.cart.clear()">clear</button>
</div>
<div class="box on"><b>Drawer</b>
  <div x-show="$store.cart.items.length === 0">empty</div>
  <div x-for="i in $store.cart.items" x-text="i"></div>
</div>
```

*Store with derived state:*

```html
<script>
  M.store('filters', {
    q: '', onlyActive: false,
    rows: [
      { id: 1, n: 'ada',   active: true  },
      { id: 2, n: 'grace', active: false },
      { id: 3, n: 'alan',  active: true  }
    ],
    get visible() {
      return this.rows.filter(r =>
        r.n.includes(this.q) && (!this.onlyActive || r.active))
    }
  })
</script>

<div class="box">
  <input x-model="$store.filters.q" placeholder="filter by name">
  <label><input type="checkbox" x-model="$store.filters.onlyActive"> active only</label>
</div>
<ul>
  <li x-for="r in $store.filters.visible" :key="r.id">
    <span x-text="r.n"></span>
    <span class="tag" x-show="r.active">active</span>
  </li>
</ul>
```

---

### $el

> The current DOM element.

**Status:** 🟡 Trade-off

**Alpine.js:**

```html
<div x-init="new Pikaday($el)"></div>
<button @click="$el.disabled = true">Once</button>
<span x-text="$el.dataset.label"></span>
```

**m.js v2:**

```js
// vnode.dom, available from _create() onward
```

> The VNode owned its node, so `$el` had no reason to exist.

**m.js v3:**

```html
<div x-init="new Pikaday($el)"></div>   <!-- ✓ correct -->
<button @click="$el.disabled = true">Once</button> <!-- ✓ -->

<span x-text="$el.dataset.label"></span>  <!-- ✗ null -->
```

> Correct in handlers, x-init and x-effect. Null in build-time expressions.

**Where it resolves and where it does not:**

- **Correct:** event handlers (from `event.currentTarget`), `x-init` and `x-effect` (from the created node).
- **Null:** build-time expressions — `x-text`, `x-html`, `:attr`, `x-show`. These are evaluated while constructing VNodes, before any DOM exists.
- This is the clearest single consequence of the architecture change. Alpine evaluates every directive as an effect attached to a live element, so `$el` is always available.
- Rarely limiting in practice: reading the DOM to decide what to render is a pattern worth avoiding. If you need it, put the value in state from `x-init`.

**Why it matters:** The direct line to the element for cases state cannot express — measuring, focusing, or handing the node to a library that wants a real DOM reference.

**Examples:**

*Where it works and where it does not:*

```html
<div x-data="{ fromInit: '', fromClick: '' }"
     x-init="fromInit = $el.tagName">
  <div class="box">
    from <code>x-text</code>:
    <b x-text="$el ? $el.tagName : 'null — no DOM yet'"></b>
  </div>
  <div class="box on">from <code>x-init</code>: <b x-text="fromInit"></b></div>
  <button @click="fromClick = $el.tagName">click me</button>
  <div class="box on">from <code>@click</code>: <b x-text="fromClick || '—'"></b></div>
</div>
```

*Self-disabling button:*

```html
<div x-data="{ sent: 0 }">
  <button @click="$el.disabled = true; sent++">
    Submit once
  </button>
  <div class="box">submitted <b x-text="sent"></b>×
  — the button disabled itself.</div>
</div>
```

---

### $dispatch

> Fire a custom, bubbling browser event from the current element.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-on:notify="…">
  <button x-on:click="$dispatch('notify')">…</button>
</div>
```

**m.js v2:**

```js
vnode.dom.dispatchEvent(
  new CustomEvent('notify', { bubbles: true }))
```

> Manual, but the same idea.

**m.js v3:**

```html
<div @notify="handle($event.detail)">
  <button @click="$dispatch('notify', { id: 7 })">…</button>
</div>
```

> Identical. Dispatches a bubbling, composed CustomEvent.

**Notes:**

- Created with `bubbles: true` and `composed: true`, so it crosses shadow boundaries and can be caught by any ancestor.
- The payload arrives as `$event.detail`.
- Because it is a real DOM event, non-m.js code can listen for it too — a useful seam when integrating with an existing page.

**Why it matters:** Child-to-parent communication without a shared store or a callback prop. It is the DOM's own event system, so it works across component boundaries, across frameworks, and with plain `addEventListener`.

**Examples:**

*Child names it, ancestor gives it meaning:*

```html
<div x-data="{ log: [] }" @item-selected="log.push('selected #' + $event.detail)">
  <div class="box">
    <b>Child</b> — dispatches, does not know the parent
    <button @click="$dispatch('item-selected', 1)">pick 1</button>
    <button @click="$dispatch('item-selected', 2)">pick 2</button>
  </div>
  <div class="box on">
    <b>Ancestor</b>
    <div x-show="log.length === 0">nothing yet</div>
    <div x-for="l in log" x-text="l"></div>
  </div>
</div>
```

*It is a real DOM event:*

```html
<script>
  addEventListener('ping', (e) => {
    const el = document.getElementById('outside')
    if (el) el.textContent = 'plain listener heard: ' + e.detail
  })
</script>

<div x-data>
  <button @click="$dispatch('ping', 'hello ' + (Date.now() % 1000))">
    dispatch
  </button>
  <div class="box" id="outside">plain listener: waiting…</div>
</div>
```

---

### $watch

> Run a callback whenever a specific expression changes.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-init="$watch('count', value => {
  console.log('count is ' + value)
})">…</div>
```

**m.js v2:**

```js
// no equivalent — no reactivity to watch
```

> Another idea with no v2 ancestor.

**m.js v3:**

```html
<div x-init="$watch('count', (value, old) => {
  console.log(old + ' → ' + value)
})">…</div>
```

> Identical, including the (new, old) callback signature.

**Notes:**

- Backed by a real tracked effect over the watched expression, so it fires only when the value actually changes — `Object.is` comparison, not a re-render count.
- The callback receives `(newValue, oldValue)`.
- Along with `x-effect` and stores, this is why the fine-grained reactive core is still in the codebase after the port.
- Register it from `x-init` so it is set up once, after the element exists.

**Why it matters:** When you care about a transition rather than a value — "when the filter changes, reset to page 1", "when the modal opens, lock scroll". x-effect re-runs on any dependency; $watch targets one and hands you the previous value.

**Examples:**

*Old and new value:*

```html
<div x-data="{ n: 0, log: [] }"
     x-init="$watch('n', (now, before) =>
       log.unshift(before + ' → ' + now + (now > before ? '  ↑' : '  ↓')))">
  <button @click="n++">+</button>
  <button @click="n--">−</button>
  <button @click="n = 0">reset</button>
  <span class="tag">n = <b x-text="n"></b></span>
  <div class="box">
    <div x-show="log.length === 0">no changes yet</div>
    <div x-for="l in log" x-text="l"></div>
  </div>
</div>
```

*React to one specific change:*

```html
<div x-data="{ filter: 'all', page: 3, resets: 0 }"
     x-init="$watch('filter', () => { page = 1; resets++ })">
  <select x-model="filter">
    <option>all</option><option>active</option><option>archived</option>
  </select>
  <button @click="page++">next page</button>
  <div class="box">
    filter <b x-text="filter"></b> ·
    page <b x-text="page"></b> ·
    auto-reset <b x-text="resets"></b>×
  </div>
</div>
```

---

### $refs

> Map of elements named with `x-ref`.

**Status:** 🟡 Trade-off

**Alpine.js:**

```html
<div x-init="$refs.button.remove()">
  <button x-ref="button">Remove Me</button>
</div>
```

**m.js v2:**

```js
// you already held the VNode; vnode.dom was the node
```

> No naming layer needed.

**m.js v3:**

```html
<div x-init="$refs.button.remove()">
  <button x-ref="button">Remove Me</button>
</div>
```

> Same, with the same create-time population caveat as x-ref.

**Same timing caveat as x-ref:**

- Populated when each named element is **created**, so the map is empty during the first build pass.
- Read it from event handlers, `x-init`, `x-effect`, or `$nextTick` — never from `x-text` or an attribute binding.
- Scoped to the enclosing `x-data` component.
- A ref survives redraws: because the diff reuses the node, `$refs.foo` keeps pointing at the same element.

**Why it matters:** A named, scoped alternative to `document.querySelector`. It cannot collide with another component's ids and it does not break when you move the markup.

**Examples:**

*Select the contents of a field:*

```html
<div x-data="{ msg: '' }">
  <input x-ref="url" value="https://example.com/share/abc123"
         readonly style="width:230px">
  <button @click="$refs.url.select();
                  msg = 'selected ' + $refs.url.value.length + ' chars'">
    Select
  </button>
  <div class="box"><b x-text="msg || '—'"></b></div>
</div>
```

*Scroll a container to the bottom:*

```html
<div x-data="{ lines: ['first line'],
  add() {
    this.lines.push('line ' + (this.lines.length + 1))
    $nextTick(() => $refs.log.scrollTop = $refs.log.scrollHeight)
  }
}">
  <button @click="add()">Add line + scroll to bottom</button>
  <div class="box" x-ref="log" style="height:90px;overflow:auto">
    <div x-for="l in lines" x-text="l"></div>
  </div>
</div>
```

---

### $nextTick

> Wait until the DOM has caught up before running code.

**Status:** 🟡 Trade-off

**Alpine.js:**

```html
<div x-text="count"
  x-init="$nextTick(() => {
    console.log('count is ' + $el.textContent)
  })">…</div>
```

**m.js v2:**

```js
// _delayedLifecycleEvents — hooks queued during the
// diff and drained after the tree was committed
```

> v2's deferred-hook queue is the same mechanism v3 uses for lifecycle, and it is why a hook can never observe a half-updated tree.

**m.js v3:**

```html
<div x-text="count"
  x-init="$nextTick(() => {
    console.log('count is ' + $el.textContent)
  })">…</div>
```

> Same API. Resolves after the diff commits, before the browser paints.

**After the redraw — but before the paint:**

- Callbacks queue and are drained by `performRedraw()` once the diff has committed and lifecycle hooks have run. A frame-scheduled fallback covers the case where no redraw was pending, so it always resolves.
- **For DOM reads this is exactly right** — `textContent`, `value`, geometry and structure all reflect the new state.
- **Found while writing this deck:** the first implementation used a bare `queueMicrotask`. Because a reactive write schedules its redraw on `requestAnimationFrame`, the microtask fired *before* the redraw and handed you a stale DOM — defeating the entire purpose. Now fixed, with a regression test pinning the ordering.
- Alpine describes its version as "the next browser paint". m.js resolves after the diff but **before** paint. For actual painted layout, use `requestAnimationFrame`.
- Returns a promise, so `await $nextTick()` works.

**Why it matters:** The gap between "I changed state" and "the DOM reflects it". Focusing an element that just became visible, or scrolling to a row that was just added, both need this.

**Examples:**

*Sync read vs $nextTick read:*

```html
<div x-data="{ n: 0, sync: '?', tick: '?' }">
  <button @click="n++;
    sync = $refs.out.textContent;
    $nextTick(() => tick = $refs.out.textContent)">
    Increment, then read the DOM two ways
  </button>
  <div class="box">rendered: <b x-ref="out" x-text="n"></b></div>
  <div class="box">
    read immediately: <b x-text="sync"></b> ← one behind<br>
    read in <code>$nextTick</code>: <b x-text="tick"></b> ← current
  </div>
</div>
```

*Focus something that just appeared:*

```html
<div x-data="{ editing: false }">
  <button @click="editing = true; $nextTick(() => $refs.field.focus())">
    Edit — focuses correctly
  </button>
  <button @click="editing = true; $refs.field && $refs.field.focus()">
    Edit — focus too early
  </button>
  <button @click="editing = false">cancel</button>
  <div class="box" x-if="editing">
    <input x-ref="field" placeholder="am I focused?">
  </div>
</div>
```

---

## API reference — Methods

### M.data

> Register a reusable scope factory, then name it from `x-data`.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<div x-data="dropdown">…</div>

Alpine.data('dropdown', () => ({
  open: false,
  toggle() { this.open = !this.open }
}))
```

**m.js v2:**

```js
class Dropdown extends Component {
  oninit() { this.state = { open: false } }
  toggle() { this.state.open = !this.state.open }
  view() { … }
}
M.component(Dropdown, attrs)
```

> v2's reuse unit was a class. v3's is a factory returning a plain object — but both end up as a ComponentVNode with instance state carried across redraws.

**m.js v3:**

```html
<div x-data="dropdown">…</div>
<div x-data="dropdown(true)">…</div>   <!-- with args -->

M.data('dropdown', (start = false) => ({
  open: start,
  toggle() { this.open = !this.open }
}))
```

> Identical, including the argument form.

**Notes:**

- The factory runs once per element instance, so each component gets its own state object.
- `x-data="name(a, b)"` evaluates the arguments against the *parent* scope and passes them to the factory.
- An `init()` method on the returned object is called once after mount; `destroy()` when the component is removed.
- `this` inside methods is the reactive scope, so `this.open = …` is tracked.

**Why it matters:** Inline x-data is perfect until the same dropdown appears eleven times. This moves the behaviour into one place without giving up the "logic next to markup" feel — the markup still says what it is, just by name.

**Examples:**

*One factory, independent instances:*

```html
<script>
  M.data('counter', (start = 0) => ({
    n: start,
    inc() { this.n++ },
    get label() { return this.n + (this.n === 1 ? ' click' : ' clicks') }
  }))
</script>

<div class="box" x-data="counter">
  <button @click="inc()">A</button> <span x-text="label"></span>
</div>
<div class="box" x-data="counter(100)">
  <button @click="inc()">B — started at 100</button> <span x-text="label"></span>
</div>
<div class="box" x-data="counter(-5)">
  <button @click="inc()">C — started at −5</button> <span x-text="label"></span>
</div>
```

*A reusable disclosure widget:*

```html
<script>
  M.data('disclosure', (openAtStart = false) => ({
    open: openAtStart,
    toggle() { this.open = !this.open },
    get label() { return this.open ? 'Hide' : 'Show' },
    get icon()  { return this.open ? '▾' : '▸' }
  }))
</script>

<div x-data="disclosure" class="box">
  <button @click="toggle()">
    <span x-text="icon"></span> <span x-text="label"></span> details
  </button>
  <div x-show="open">Closed by default.</div>
</div>
<div x-data="disclosure(true)" class="box">
  <button @click="toggle()">
    <span x-text="icon"></span> <span x-text="label"></span> details
  </button>
  <div x-show="open">Open by default — same factory, one argument.</div>
</div>
```

---

### M.component

> Register a named widget that owns its template, then invoke it with `x-component`.

**Status:** 🔵 Beyond Alpine

**Alpine.js:**

```js
// Alpine.data is scope-only — there is no
// "this component's markup" to register.
```

**m.js v2:**

```js
class Button extends Component {
  view() {
    return m('button.btn', this.attrs, this.attrs.label)
  }
}
m(Button, { label: 'Send', color: 'primary' })
```

> v2 registered a class and called it with m(). v3 registers a definition object (or factory) and calls it from a template.

**m.js v3:**

```js
M.component('uiButton', {
  props: ['variant', 'label', 'disabled'],
  variant: '',
  label: '',
  disabled: false,
  template: `<button type="button" class="btn"
              :class="variant" :disabled="disabled"
              x-text="label"></button>`
})

// later, anywhere:
// <span x-component="uiButton" variant="primary" label="Send"></span>
```

> Object form shares the definition as a prototype (getters and methods live once). Factory form `(props) => ({ template, … })` runs once per instance — use it when the widget has local state.

**Notes:**

- `M.component(name, def)` writes the registry; `M.component(name)` reads it back.
- `props` lists the names copied from the host. Bound values (`:priority="c.priority"`) are evaluated in the parent scope on every redraw and patched onto the instance — `init()` is not re-run.
- An `init()` method runs once after mount; `destroy()` when the instance is removed.
- Re-registering the same name (HMR) updates the template for the next view. Existing instances keep their state.
- This is not v2's `M.component(Class, attrs)` hyperscript call. The v3 spelling is the registry; the call site is the `x-component` directive.

**Why it matters:** x-data reused behaviour. x-component reuses markup. A 100-widget catalog is only possible if changing Button once updates every Composer, Dialog and Toolbar that invokes it.

**Examples:**

*Object form with a getter:*

```html
<script>
  M.component('prio', {
    props: ['priority'],
    priority: 'p2',
    get meta() {
      return {
        p1: { s: 'P1', c: '#ef4444' },
        p2: { s: 'P2', c: '#f97316' },
        p3: { s: 'P3', c: '#eab308' },
      }[this.priority]
    },
    template: `<span class="tag" :style="'outline-color:'+meta.c" x-text="meta.s"></span>`
  })
</script>

<div x-data="{ p: 'p2' }">
  <button @click="p = 'p1'">P1</button>
  <button @click="p = 'p2'">P2</button>
  <button @click="p = 'p3'">P3</button>
  <div class="box on">
    current: <span x-component="prio" :priority="p"></span>
  </div>
</div>
```

*Factory form — local state per instance:*

```html
<script>
  M.component('tally', () => ({
    n: 0,
    inc() { this.n++ },
    template: `<button type="button" @click="inc()">
      <span x-text="n"></span> clicks
    </button>`
  }))
</script>

<div class="box"><span x-component="tally"></span></div>
<div class="box"><span x-component="tally"></span></div>
```

---

### M.store

> Declare global reactive state, readable anywhere via `$store`.

**Status:** 🟢 Full parity

**Alpine.js:**

```html
<button @click="$store.notifications.notify('…')">
  Notify
</button>

Alpine.store('notifications', {
  items: [],
  notify(message) { this.items.push(message) }
})
```

**m.js v2:**

```js
// module-level object; every mutation needed
// an explicit M.redraw()
```

> The absence of this is the clearest illustration of what "no reactivity" cost you in v2.

**m.js v3:**

```html
<button @click="$store.notifications.notify('…')">
  Notify
</button>

M.store('notifications', {
  items: [],
  notify(message) { this.items.push(message) }
})
```

> Identical, plus HMR-safe persistence across hot reloads.

**Notes:**

- Stores live in a bucket on `window` keyed by name, so a hot reload re-registers the definition without discarding the data.
- Re-registering an existing store **merges new methods and adds new keys, but leaves existing data alone** — exactly what you want while editing a file with a live app open.
- Any write schedules a single coalesced redraw; 50 writes in a tick produce one render.
- A Zustand-flavoured `M.createStore` is also available for code that prefers a selector/subscribe API.

**Why it matters:** The app-wide state layer. Notifications, auth, cart, theme, feature flags — anything more than one component needs to see, without a provider tree or an event bus.

**Examples:**

*Self-managing toast queue:*

```html
<script>
  M.store('toasts', {
    items: [],
    push(text) {
      const id = Date.now() + Math.random()
      this.items.push({ id, text })
      setTimeout(() => this.dismiss(id), 3000)
    },
    dismiss(id) { this.items = this.items.filter(t => t.id !== id) }
  })
</script>

<div class="box">
  <button @click="$store.toasts.push('Saved')">Save</button>
  <button @click="$store.toasts.push('Deleted')">Delete</button>
</div>
<div class="box on">
  <div x-show="$store.toasts.items.length === 0">no toasts — they expire after 3s</div>
  <div x-for="t in $store.toasts.items" :key="t.id" x-text="t.text"></div>
</div>
```

*Theme read at the root, written from anywhere:*

```html
<script>
  M.store('ui', {
    theme: 'light',
    toggle() { this.theme = this.theme === 'light' ? 'dark' : 'light' },
    get isDark() { return this.theme === 'dark' }
  })
</script>

<div :style="$store.ui.isDark
     ? 'background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px'
     : 'background:#f8fafc;color:#0f172a;padding:12px;border-radius:8px'">
  <b>Root</b> reads the theme
  <div style="margin-top:8px">
    <button @click="$store.ui.toggle()">
      switch to <span x-text="$store.ui.isDark ? 'light' : 'dark'"></span>
    </button>
  </div>
  <p style="margin-top:8px;font-size:12px">
    theme = <code x-text="$store.ui.theme"></code>
  </p>
</div>
```

---

## Extras

### Router

> Pathname or hash routing, params, base-path detection — and a diff instead of a reload.

The router ships with m.js and needs no extra package. Navigation runs the same reconciliation as any other state change, so the parts of the page that both routes share — your shell, sidebar, scroll position, a focused input — survive the transition instead of being rebuilt.

#### Path mode — default

```js
Router.register('/', 'Home', () => Home())
Router.register('/users/:id', 'User', (p) => User(p))
Router.rewrite('/index.html', '/')

M.mount('#app')            // factory defaults to Router.render
```

URLs look like `/users/3`. Needs a server that returns your `index.html` for unknown paths, or a 404 fallback — otherwise a hard refresh 404s.

#### Hash mode — any static host

```js
Router.setMode('hash')     // before start()
Router.register('/', 'Home', () => Home())
Router.register('/users/:id', 'User', (p) => User(p))

M.mount('#app')
```

URLs look like `/#/users/3`. No server cooperation at all, so deep links and refreshes just work on GitHub Pages, S3 or any CDN.

#### Standalone demos

- [Hash routing demo](./demos/router-hash.html) — open and watch the URL change as you click, then hit reload
- [Path routing demo](./demos/router-path.html)

#### API

| Call | What it does |
|------|--------------|
| `Router.setMode(m)` | `'path'` (default) or `'hash'`. Call before `start()`. |
| `Router.register(uri, title, fn)` | Route with `:params`; `fn(params)` returns a component. |
| `Router.rewrite(from, to)` | Alias one path onto another. |
| `Router.set(uri)` | Navigate. Pushes history and redraws. |
| `Router.uri` / `.params` | Current app path and matched params. |
| `Router.href(uri)` | Prefixed href for the current mode — use it in `:href`. |
| `Router.link` | Click handler for internal `<a>`; ctrl-click still opens a tab. |
| `Router.setBase(p)` / `detectBase()` | Subdirectory hosting, e.g. `/m-js`. Path mode only. |
| `Router.setTitleFormat(fn)` | Map a route title to `document.title`. |
| `Router.onChange(fn)` | Fires after every navigation. |

#### Deploying path mode

```js
// Express — serve index.html for anything unmatched
app.use(express.static('public'))
app.get('*', (_, res) => res.sendFile('public/index.html'))
```

```nginx
# nginx
location / { try_files $uri $uri/ /index.html; }
```

> On a static host with no rewrite rules, use hash mode instead — that is exactly why it exists. This documentation site itself is hash-routed for that reason.

#### Examples

*Hash routing, end to end:*

```html
<div id="app"></div>
<script>
  const Shell = (body) => ({
    template: `
      <div class="box" style="font:12px ui-monospace,monospace">
        this frame's URL → <b x-text="url"></b>
      </div>
      <nav style="margin:8px 0">
        <a :href="href('/')" @click="go">Home</a> ·
        <a :href="href('/guide')" @click="go">Guide</a> ·
        <a :href="href('/users/7')" @click="go">User 7</a>
      </nav>
      <div class="box on">${body}</div>
    `,
    get url() { return location.hash || '#/' },
    href: (u) => M.Router.href(u),
    go: M.Router.link,
  })

  M.Router.setMode('hash')
  M.Router.register('/', 'Home', () => Shell('<h4>Home</h4>Pick a link.'))
  M.Router.register('/guide', 'Guide', () => Shell('<h4>Guide</h4>Still one page.'))
  M.Router.register('/users/:id', 'User',
    (p) => Shell('<h4>User ' + p.id + '</h4>Matched from <code>:id</code>.'))
  M.mount('#app')
</script>
```

*Reading params and reacting to navigation:*

```html
<div id="app"></div>
<script>
  const log = []
  const Page = (label) => ({
    template: `
      <nav>
        <a :href="href('/a/1')" @click="go">/a/1</a> ·
        <a :href="href('/a/2')" @click="go">/a/2</a> ·
        <a :href="href('/b/x')" @click="go">/b/x</a>
      </nav>
      <div class="box on">${label}
        <div>params = <code x-text="JSON.stringify(params)"></code></div>
      </div>
      <div class="box">visits:
        <div x-for="l in log" x-text="l"></div>
      </div>
    `,
    log,
    get params() { return M.Router.params },
    href: (u) => M.Router.href(u),
    go: M.Router.link,
  })

  M.Router.setMode('hash')
  M.Router.onChange(() => log.push(M.Router.uri))
  M.Router.register('/', 'Start', () => Page('<h4>Start</h4>'))
  M.Router.register('/a/:n', 'A', (p) => Page('<h4>Section A #' + p.n + '</h4>'))
  M.Router.register('/b/:slug', 'B', (p) => Page('<h4>Section B: ' + p.slug + '</h4>'))
  M.mount('#app')
</script>
```

*The shell survives navigation:*

```html
<div id="app"></div>
<script>
  const Shell = (body) => ({
    template: `
      <nav>
        <a :href="href('/')" @click="go">one</a> ·
        <a :href="href('/two')" @click="go">two</a> ·
        <a :href="href('/three')" @click="go">three</a>
      </nav>
      <div class="box">
        shell input (type here, then navigate):
        <input placeholder="I survive route changes">
      </div>
      <div class="box on">${body}</div>
    `,
    href: (u) => M.Router.href(u),
    go: M.Router.link,
  })

  M.Router.setMode('hash')
  M.Router.register('/', 'One', () => Shell('<h4>Route one</h4>'))
  M.Router.register('/two', 'Two', () => Shell('<h4>Route two</h4>'))
  M.Router.register('/three', 'Three', () => Shell('<h4>Route three</h4>'))
  M.mount('#app')
</script>
```

---

### What m.js adds

> The parts with no Alpine equivalent at all — mostly inherited from v2.

#### Root components + templates

```js
M.mount('#app', () => ({
  template: `
    <h1 x-text="title"></h1>
    <button @click="go()">Next</button>
  `,
  title: 'Hello',
  go() { Router.set('/next') }
}))
```

A component is just `{ template, ...state }`. The template string is parsed once and cached; state and methods sit alongside it. This is the mode the docs site and the sheets app use.

#### Router

```js
Router.register('/', 'Home', () => Home())
Router.register('/post/:id', 'Post', (p) => Post(p))
Router.setBase('/m-js')
M.mount('#app')          // factory defaults to Router.render

// in markup:
<a :href="Router.href('/post/1')" @click="Router.link">…</a>
```

Pathname routing with params, base-path detection and title formatting. Navigation is a diff, not a reload — the shell survives a route change instead of being rebuilt.

#### x-mount — nest a component from scope

```html
<main x-mount="page"></main>
```

Mounts a `{ template, … }` object held in state as a child component. This is how the docs layout injects the current page into its shell.

#### x-component — named widgets that own their markup

```js
M.component('prio', { props: ['priority'], template: '…' })
```

```html
<span x-component="prio" :priority="c.priority"></span>
```

The Alpine-shaped spelling of v2's `m(Name, attrs)`. Props evaluate in the parent (list-safe). Compound templates invoke primitives instead of copying their HTML.

#### Redraw control & instrumentation

```js
M.redraw()               // synchronous diff
M.deferredBatchRedraw()  // coalesced to one per frame
M.refreshCount           // redraws requested — the counter in every preview
M.takePerfStats()        // { flushes, effects, redraws }
```

Explicit redraw exists for imperative escape hatches, but you rarely need it: any reactive write schedules one coalesced redraw automatically.

> **The property that makes all of this safe:** Redrawing with unchanged state performs **zero DOM writes** — verified by a MutationObserver test that calls `M.redraw()` ten times and asserts an empty record list. That is why explicit redraws, coarse invalidation and route changes are all cheap: the diff is a fixed point.

---

### The complete gap list

> Everything in Alpine's core surface that m.js v3 does not do — in one place.

#### Not implemented

- **x-transition staged API** — `x-transition:enter`, `:enter-start`, `:enter-end`, `:leave`, … Needs imperative multi-frame choreography.
- **x-transition on x-if** — leave transitions need deferred node removal, which the diff has no mechanism for. The `onbeforeremove` hook exists but nothing awaits it.
- **x-bind="objectOfAttrs"** — the spread form. Bind attributes individually.
- **Implicit `await` in expressions** — Alpine compiles directives to async functions; m.js compiles them to synchronous ones. Use `.then()` and assign to state.
- **x-on modifiers** `.debounce` `.throttle` `.camel` `.dot` `.away`
- **x-model modifiers** `.debounce` `.throttle` `.fill` `.boolean`

#### Implemented, but different — know these

- **`$el` is null in build-time expressions** (`x-text`, `:attr`, `x-show`, `x-html`). Correct in handlers, `x-init`, `x-effect`.
- **`$refs` is empty on the first build pass.** Read it from handlers, `x-init` or `$nextTick`.
- **`$nextTick` resolves after the redraw but before the paint.** Correct for DOM reads; use `requestAnimationFrame` if you need the browser to have painted.
- **`x-ignore` captures markup** rather than skipping a DOM walk.
- **Empty string is a value, not a removal.** `:alt="''"` keeps the attribute; only `null`/`undefined`/`false` remove it.
- **Directive names are case-insensitive** — the HTML parser lower-cases attribute names, so camelCase directive spellings are impossible (same constraint as Alpine).

#### Better than Alpine here

- **x-if and x-for work on bare elements**, not only inside `<template>`.
- **x-for takes objects, integer ranges and any iterable**, and always exposes `$index`.
- **Keyed reconciliation with LIS reordering** — reversing 20 rows performs 19 moves and rebuilds nothing.
- **Foreign-target listeners are tracked and torn down** when the element is removed.
- **`@window.resize`** accepted alongside `@resize.window`.
- **A root component / Router / HMR layer** that Alpine leaves entirely to you.
- **`x-component` / `M.component`** — a widget owns its template and is invoked by name with bound props. Alpine's `x-data` only injects a scope; the caller still types the HTML.

---

*Generated from `index.html` (m.js v3.2.1 docs) — 2026-08-10. Interactive labs and live previews are available only in the HTML version.*
