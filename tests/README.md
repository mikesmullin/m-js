# m-js test suite

Unit tests for the m.js v3 runtime, run with **Bun** + **happy-dom** (browser APIs mocked).

## Run

```bash
cd vendor/m-js   # or /workspace/cowork/vendor/m-js
bun install
bun test
# or
bun run test
```

## Layout

| File | Coverage |
|------|----------|
| `reactive.test.js` | Deep `reactive()` / `effect()`, array mutators, method `this` binding |
| `lis.test.js` | `longestIncreasingSubsequence` (VDOM reorder helper) |
| `x-for.test.js` | Keyed list reconcile: push/splice/reorder/in-place update/row actions |
| `alpine.test.js` | `x-text`, `x-html`, `x-show`, `x-model`, `@click`, `:bind`, `x-if`, `x-ref`, `x-init`, `x-cloak`, `M.data`, `$store` |
| `store.test.js` | `M.store` HMR merge + `createStore` (Zustand-style) |
| `router.test.js` | match/params/set/base/link/404 |
| `mount.test.js` | `M.mount`, remount + store survival, `m-mount` |
| `hot-client.test.js` | WS `/__m_hmr`, CSS swap, `onHotReload`, `__M_BOOT__`, `m:hmr` event |

## Notes

- Each DOM test calls `installDom()` / `resetFramework()` so Router + HMR store buckets stay isolated.
- Cowork’s app-level Vite-shaped HMR (`public/js/hmr.js`) is separate; this package tests **m-js `hot-client`**.
