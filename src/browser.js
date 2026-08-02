/**
 * Browser / CDN entry for m.js.
 * Production surface only — no HMR client, no Bun dev server.
 *
 * Usage (ES module):
 *   import M, { Router } from 'https://mikesmullin.github.io/m-js/dist/m.min.js'
 *
 * Or drop-in (sets window.M / window.m as a side effect):
 *   <script type="module" src="https://mikesmullin.github.io/m-js/dist/m.min.js"></script>
 */
export {
  default,
  M,
  default as m,
  reactive,
  effect,
  initTree,
  destroyTree,
  longestIncreasingSubsequence,
  takeDrawCalls,
  takePerfStats,
  flushSync,
} from './m.js';
export { Router } from './router.js';
export { createStore, clearStore } from './store.js';
