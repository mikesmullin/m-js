/**
 * m.js v3 — Alpine-compatible UI runtime on a v2 virtual DOM.
 *
 * Templates are HTML strings carrying Alpine directives (x-*, @, :). They are
 * parsed once into a static AST; every redraw evaluates that AST against the
 * current scope to produce VNodes, and the diff applies the minimum set of
 * DOM operations. Redrawing with unchanged state is a no-op.
 *
 * Directives: x-data, x-bind, x-on, x-text, x-html, x-model, x-show,
 *   x-transition (x-show only), x-for, x-if, x-init, x-effect, x-ref,
 *   x-cloak, x-ignore, x-mount
 * Magics: $store, $el, $dispatch, $watch, $refs, $nextTick
 * Shorthands: @click → x-on:click, :class → x-bind:class; m-* aliases work.
 */

import { Router } from './router.js';
import { createStore as createZustandStore } from './store.js';
import {
  Component,
  ComponentVNode,
  FragmentVNode,
  delayedLifecycleEvents,
  longestIncreasingSubsequence,
  setDebug as setVdomDebug,
  updateNodes,
} from './vdom.js';
import { parseElement, parseTemplate } from './parse.js';
import { buildFragment, buildTemplate } from './build.js';
import {
  dataRegistry,
  evaluate,
  evaluateAction,
  getStoresRoot,
  setDebug as setScopeDebug,
  storeBucket,
} from './scope.js';
import {
  bumpRedrawCount,
  drainAfterRender,
  effect,
  flushSync,
  onInvalidate,
  reactive,
  scheduleFrame,
  takeDrawCalls,
  takePerfStats,
} from './reactive.js';

const VERSION = '3.2.1';

export {
  reactive,
  effect,
  flushSync,
  takeDrawCalls,
  takePerfStats,
  longestIncreasingSubsequence,
};

// ---------------------------------------------------------------------------
// Root state
// ---------------------------------------------------------------------------

let rootEl = null;
let rootFactory = null;
let rootInstance = null;
let rootCtx = null;
let oldRoot = null;

let renderCount = 0;
let refreshRequestCount = 0;
let alreadyRedrawing = false;
let deferredBatchRedraw = false;
let deferredQueued = false;

/** Extra mount points created by initTree() (progressive enhancement). */
const mounts = new Set();

function instantiate(configOrFactory, attrs = {}) {
  let config =
    typeof configOrFactory === 'function'
      ? configOrFactory(attrs)
      : configOrFactory;
  if (config == null || typeof config !== 'object') {
    config = { template: String(config ?? '') };
  }
  if (typeof config === 'function') config = config(attrs);
  if (!config.template) config.template = '';
  config.$attrs = attrs;
  return reactive(config);
}

function renderRoot() {
  if (!rootInstance) return null;
  return buildTemplate(rootInstance.template || '', rootInstance, rootCtx);
}

function drainLifecycle() {
  // Hooks never run inside the diff — a hook that redraws cannot re-enter a
  // half-updated tree.
  const hooks = delayedLifecycleEvents.splice(0, delayedLifecycleEvents.length);
  for (const hook of hooks) {
    try {
      hook();
    } catch (e) {
      console.error('[m] lifecycle', e);
    }
  }
}

function performRedraw() {
  bumpRedrawCount();
  if (rootEl && rootFactory) {
    if (!rootInstance) {
      rootInstance = instantiate(rootFactory());
      rootCtx = { refs: {}, getEl: () => rootEl };
    }
    const next = renderRoot();
    updateNodes(rootEl, oldRoot, next, null);
    oldRoot = next;
  }
  for (const mount of mounts) {
    const next = buildFragment(mount.ast, mount.scope, mount.ctx);
    updateNodes(mount.parent, mount.old, next, mount.nextSibling);
    mount.old = next;
  }
  drainLifecycle();
  renderCount++;
  // $nextTick callbacks run last: the DOM is committed and hooks have fired.
  drainAfterRender();
}

// ---------------------------------------------------------------------------
// Component mount helper (x-mount / M.mount)
// ---------------------------------------------------------------------------

const instanceCache = new Map();

function clearInstances() {
  for (const inst of instanceCache.values()) {
    if (typeof inst.destroy === 'function') {
      try {
        inst.destroy();
      } catch (_) {}
    }
  }
  instanceCache.clear();
}

// ---------------------------------------------------------------------------
// Progressive enhancement: initTree over server-rendered DOM
// ---------------------------------------------------------------------------

/**
 * Take over a live element: its markup is parsed into an AST, rebuilt as
 * VNodes and swapped in. The returned element is the built one — the original
 * node is replaced, not adopted.
 */
export function initTree(el, scope) {
  const root = el === document ? document.body : el;
  if (!root) return root;

  if (root === document.body || root.tagName === 'BODY') {
    // Enhance each child independently so <body> itself is left alone.
    const out = [];
    for (const child of [...root.children]) out.push(initTree(child, scope));
    return out[0] ?? root;
  }

  const ast = [parseElement(root)].filter(Boolean);
  const ctx = { refs: {}, getEl: () => null };
  const mount = {
    ast,
    scope: scope ?? {},
    ctx,
    parent: root.parentNode,
    nextSibling: root.nextSibling,
    old: null,
  };
  if (!mount.parent) return root;
  root.remove();

  const next = buildFragment(ast, mount.scope, ctx);
  updateNodes(mount.parent, null, next, mount.nextSibling);
  mount.old = next;
  mounts.add(mount);
  drainLifecycle();

  const first = next._siblings[next._keys[0]]?.vnode;
  const dom = first?._getNextSibling()?.dom ?? null;
  if (dom) mount.el = dom;
  return dom ?? root;
}

/** Tear down a subtree mounted by initTree(). */
export function destroyTree(el) {
  for (const mount of [...mounts]) {
    if (!mount.old) continue;
    if (mount.el === el || (el && mount.el && el.contains(mount.el))) {
      FragmentVNode._delete(mount.old, mount.parent);
      mounts.delete(mount);
    }
  }
}

// ---------------------------------------------------------------------------
// M
// ---------------------------------------------------------------------------

export const M = {
  version: VERSION,

  set debug(on) {
    setVdomDebug(on);
    setScopeDebug(on);
  },

  /** Register a named x-data component factory. */
  data(name, factory) {
    dataRegistry.set(name, factory);
    return factory;
  },

  /** Define or read a global store. */
  store(name, value) {
    const bucket = storeBucket();
    const root = getStoresRoot();
    if (value === undefined) return root[name];

    const existing = bucket.get(name);
    if (existing) {
      // merge new methods onto existing state (keep data)
      const incoming = typeof value === 'function' ? value() : value;
      for (const k of Object.keys(incoming)) {
        if (typeof incoming[k] === 'function') existing[k] = incoming[k];
        else if (!(k in existing)) existing[k] = incoming[k];
      }
      root[name] = existing;
      return existing;
    }
    const data = typeof value === 'function' ? value() : value;
    const proxy = reactive(
      data && typeof data === 'object' ? data : { value: data },
    );
    bucket.set(name, proxy);
    root[name] = proxy;
    if (typeof proxy.init === 'function') queueMicrotask(() => proxy.init());
    return proxy;
  },

  /** Start M over existing markup (progressive enhancement). */
  start(root = document) {
    installCloakStyle();
    return initTree(root === document ? document.body : root);
  },

  initTree,
  destroyTree,

  // m.js extras
  Router,
  createStore: createZustandStore,

  /** Mount a root component factory (Router-friendly). */
  mount(el, factory) {
    rootEl = typeof el === 'string' ? document.querySelector(el) : el || document.body;
    rootFactory =
      factory != null
        ? typeof factory === 'function'
          ? factory
          : () => factory
        : () => Router.render();

    installCloakStyle();

    Router.onChange(() => {
      clearInstances();
      rootInstance = null;
      rootCtx = null;
      M.deferredBatchRedraw();
    });
    Router.start();
    M.redraw();
    return rootInstance;
  },

  unmount() {
    if (rootEl && oldRoot) FragmentVNode._delete(oldRoot, rootEl);
    for (const mount of [...mounts]) {
      if (mount.old) FragmentVNode._delete(mount.old, mount.parent);
    }
    mounts.clear();
    clearInstances();
    oldRoot = null;
    rootEl = null;
    rootFactory = null;
    rootInstance = null;
    rootCtx = null;
    Router.stop();
  },

  /**
   * Diff the current tree against the DOM. Re-entrancy collapses to a single
   * follow-up pass; a redraw with unchanged state performs no DOM writes.
   */
  redraw() {
    refreshRequestCount++;
    if (alreadyRedrawing) {
      deferredBatchRedraw = true;
      return;
    }
    alreadyRedrawing = true;
    try {
      performRedraw();
    } finally {
      alreadyRedrawing = false;
    }
    if (deferredBatchRedraw) {
      deferredBatchRedraw = false;
      M.redraw();
    }
  },

  /**
   * Use from inside lifecycle callbacks. Re-entrant: call many times, only one
   * draw occurs. If already drawing, waits until the current pass is done.
   */
  deferredBatchRedraw() {
    if (alreadyRedrawing) {
      deferredBatchRedraw = true;
      return;
    }
    if (deferredQueued) return;
    deferredQueued = true;
    scheduleFrame(() => {
      deferredQueued = false;
      M.redraw();
    });
  },

  invalidate() {
    // Drops rendered instances, not store data — remounting must not lose it.
    clearInstances();
    rootInstance = null;
    rootCtx = null;
    oldRoot = null;
  },

  get renderCount() {
    return renderCount;
  },
  get refreshCount() {
    return refreshRequestCount;
  },
  /** @deprecated use takePerfStats().flushes */
  get drawCallCount() {
    return takePerfStats().flushes;
  },
  takeDrawCalls,
  takePerfStats,
  flushSync,
  get root() {
    return rootInstance;
  },

  link: Router.link,
  evaluate,
  evaluateAction,
  magic: {},

  // VDOM surface, for tests and advanced use
  Component,
  ComponentVNode,
  parseTemplate,
  buildTemplate,
  updateNodes,
};

function installCloakStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('m-cloak-style')) return;
  const s = document.createElement('style');
  s.id = 'm-cloak-style';
  s.textContent = '[x-cloak],[m-cloak]{display:none !important;}';
  document.head.appendChild(s);
}

// Any reactive write schedules one coalesced redraw. Reads never do, so a
// render cannot invalidate itself — the feedback edge that caused hot loops
// under the effect-per-binding model does not exist here.
onInvalidate(() => {
  if (rootEl || mounts.size) M.deferredBatchRedraw();
});

export default M;

if (typeof window !== 'undefined') {
  window.M = M;
  window.m = M;
}
