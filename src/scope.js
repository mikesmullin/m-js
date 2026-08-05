/**
 * m.js expression evaluation, magics and registries.
 *
 * Expressions are compiled once per source string and cached; the renderer
 * evaluates them on every redraw, so compilation must not be on that path.
 */

import { reactive, effect, RAW } from './reactive.js';

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

export const dataRegistry = new Map();

const STORE_HMR = '__M_ALPINE_STORES__';
const localStoreBucket = new Map();

export function storeBucket() {
  if (typeof window === 'undefined') return localStoreBucket;
  if (!window[STORE_HMR]) window[STORE_HMR] = new Map();
  return window[STORE_HMR];
}

let storesRoot = null;

export function getStoresRoot() {
  if (!storesRoot) {
    const raw = {};
    for (const [k, v] of storeBucket()) raw[k] = v;
    storesRoot = reactive(raw);
  }
  return storesRoot;
}

export function resetStoresRoot() {
  storesRoot = null;
}

// ---------------------------------------------------------------------------
// Compilation cache
// ---------------------------------------------------------------------------

const exprCache = new Map();
const actionCache = new Map();

function compile(cache, expr, body) {
  let fn = cache.get(expr);
  if (fn !== undefined) return fn;
  try {
    fn = new Function('$scope', '$magics', body);
  } catch (_) {
    fn = null;
  }
  cache.set(expr, fn);
  return fn;
}

// ---------------------------------------------------------------------------
// Magics
// ---------------------------------------------------------------------------

/**
 * ctx carries what the magics need without forcing the caller to have a live
 * DOM node: { getEl, refs, dispatch }. During the build pass no DOM exists
 * yet, so $el / $refs resolve to null / {} until create has run.
 */
export function buildMagics(scope, ctx = {}) {
  return {
    get $el() {
      return ctx.getEl?.() ?? null;
    },
    get $refs() {
      return ctx.refs ?? {};
    },
    get $store() {
      return getStoresRoot();
    },
    $dispatch(name, detail) {
      const el = ctx.getEl?.();
      el?.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true }),
      );
    },
    $watch(property, callback) {
      let prev = evaluate(property, scope, ctx);
      return effect(() => {
        const next = evaluate(property, scope, ctx);
        if (!Object.is(prev, next)) {
          const old = prev;
          prev = next;
          callback(next, old);
        }
      });
    },
    $nextTick(fn) {
      return new Promise((resolve) => {
        queueMicrotask(() => {
          fn?.();
          resolve();
        });
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------

export let DEBUG = false;

export function setDebug(on) {
  DEBUG = !!on;
}

/** Evaluate an expression (a value) against scope + magics. */
export function evaluate(expr, scope, ctx, $event) {
  if (expr == null || expr === '') return undefined;
  const fn = compile(
    exprCache,
    expr,
    `with ($magics) { with ($scope) { return (${expr}); } }`,
  );
  if (!fn) return undefined;
  try {
    const magics = buildMagics(scope, ctx);
    if ($event !== undefined) magics.$event = $event;
    return fn(scope ?? {}, magics);
  } catch (err) {
    if (DEBUG) console.warn('[m] eval:', expr, err);
    return undefined;
  }
}

/** Run statement(s) — events, x-init, x-effect. */
export function evaluateAction(expr, scope, ctx, $event) {
  if (!expr) return;
  const fn = compile(
    actionCache,
    expr,
    `with ($magics) { with ($scope) { ${expr} } }`,
  );
  if (!fn) return evaluate(expr, scope, ctx, $event);
  try {
    const magics = buildMagics(scope, ctx);
    if ($event !== undefined) magics.$event = $event;
    return fn(scope ?? {}, magics);
  } catch (err) {
    if (DEBUG) console.warn('[m] action:', expr, err);
    return undefined;
  }
}

/** Assign through a dotted path, honouring $store.* roots. */
export function assignPath(scope, path, value) {
  const trimmed = String(path).trim();
  if (trimmed.startsWith('$store.')) {
    const parts = trimmed.slice(7).split('.');
    let obj = getStoresRoot();
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (obj == null) return;
    }
    obj[parts[parts.length - 1]] = value;
    return;
  }
  const parts = trimmed.split('.');
  let obj = scope;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
    if (obj == null) return;
  }
  obj[parts[parts.length - 1]] = value;
}

/**
 * Resolve an x-data expression into a reactive scope that inherits from its
 * parent via the prototype chain (raw target, so proxy traps do not nest).
 */
export function createDataScope(expression, parentScope, ctx) {
  let data;
  const expr = (expression ?? '').trim() === '' ? '{}' : expression.trim();

  // Named component: x-data="dropdown" or x-data="dropdown(args)"
  const named = expr.match(/^([A-Za-z_$][\w$]*)(\s*\(.*\))?$/);
  if (named && dataRegistry.has(named[1])) {
    const factory = dataRegistry.get(named[1]);
    if (named[2]) {
      // named[2] is "(a, b)" — evaluate the inside as an array literal.
      const inner = named[2].trim().slice(1, -1);
      const args = inner
        ? evaluate(`[${inner}]`, parentScope || {}, ctx) || []
        : [];
      data = factory(...args);
    } else {
      data = factory();
    }
  } else {
    data = evaluate(expr, parentScope || {}, ctx);
  }

  if (data == null || data === true) data = {};
  if (typeof data !== 'object') data = { value: data };

  // Inherit the parent's *raw* target: a proxy on the prototype chain would
  // capture plain assignments to the child through its own set trap.
  if (parentScope) {
    const parentRaw = parentScope[RAW] || parentScope;
    if (data !== parentRaw && Object.getPrototypeOf(data) !== parentRaw) {
      Object.setPrototypeOf(data, parentRaw);
    }
  }

  return reactive(data);
}

export function stringify(v) {
  if (v == null || v === false) return '';
  return String(v);
}
