/**
 * m.js reactive core.
 *
 * Fine-grained dependency tracking backs x-effect, $watch and store
 * subscriptions. DOM patching does NOT go through effects — that is the
 * VDOM diff's job. Any write also raises a coarse invalidation so the
 * renderer knows to schedule a redraw.
 */

const REACTIVE = Symbol('m.reactive');
const RAW = Symbol('m.raw');
const ITERATE_KEY = Symbol('m.iterate');

export { REACTIVE, RAW, ITERATE_KEY };

/** raw object → proxy (so we never double-wrap) */
export const proxyMap = new WeakMap();
/** raw object → cached bound methods */
const boundMethodCache = new WeakMap();

let activeEffect = null;
const deps = new WeakMap();

const queued = new Set();
let pending = false;
let runsThisFlush = 0;
const MAX_EFFECT_RUNS_PER_FLUSH = 10000;

/** Coarse "something changed" listeners — the renderer subscribes here. */
const invalidationListeners = new Set();

export function onInvalidate(fn) {
  invalidationListeners.add(fn);
  return () => invalidationListeners.delete(fn);
}

/**
 * Callbacks that must not run until the DOM reflects the current state
 * ($nextTick). A redraw drains this queue once it has committed; the frame
 * fallback covers the case where no redraw was pending at all.
 *
 * Ordering matters: a reactive write schedules its redraw frame *before*
 * $nextTick schedules this one, and frame callbacks run in registration
 * order — so the redraw drains the queue first and this is a no-op.
 */
const afterRenderQueue = [];
let afterRenderScheduled = false;

export function afterRender(fn) {
  afterRenderQueue.push(fn);
  if (afterRenderScheduled) return;
  afterRenderScheduled = true;
  scheduleFrame(() => {
    afterRenderScheduled = false;
    drainAfterRender();
  });
}

export function drainAfterRender() {
  if (afterRenderQueue.length === 0) return;
  const list = afterRenderQueue.splice(0, afterRenderQueue.length);
  for (const fn of list) {
    try {
      fn();
    } catch (e) {
      console.error('[m] $nextTick', e);
    }
  }
}

let flushCount = 0;
let effectCount = 0;
let redrawCount = 0;

export function bumpRedrawCount() {
  redrawCount++;
  flushCount++;
}

function scheduleFrame(cb) {
  const raf =
    (typeof requestAnimationFrame === 'function' && requestAnimationFrame) ||
    (typeof globalThis !== 'undefined' &&
      typeof globalThis.requestAnimationFrame === 'function' &&
      globalThis.requestAnimationFrame) ||
    null;
  if (raf) return raf.call(globalThis, cb);
  return queueMicrotask(cb);
}

export { scheduleFrame };

export function takePerfStats() {
  const s = { flushes: flushCount, effects: effectCount, redraws: redrawCount };
  flushCount = 0;
  effectCount = 0;
  redrawCount = 0;
  return s;
}

export function takeDrawCalls() {
  return takePerfStats().flushes;
}

function track(target, key) {
  if (!activeEffect) return;
  let byKey = deps.get(target);
  if (!byKey) {
    byKey = new Map();
    deps.set(target, byKey);
  }
  let set = byKey.get(key);
  if (!set) {
    set = new Set();
    byKey.set(key, set);
  }
  set.add(activeEffect);
  activeEffect._deps?.add(set);
}

function trigger(target, key) {
  for (const fn of invalidationListeners) fn();
  const byKey = deps.get(target);
  if (!byKey) return;
  const effects = new Set();
  const exact = byKey.get(key);
  if (exact) for (const e of exact) effects.add(e);
  // Arrays use length for iteration. Plain-object iteration only reruns when
  // keys are added or removed (handled by the proxy traps below).
  if (key === 'length') {
    const iter = byKey.get(ITERATE_KEY);
    if (iter) for (const e of iter) effects.add(e);
  }
  for (const e of effects) scheduleEffect(e);
}

function scheduleEffect(e) {
  queued.add(e);
  if (pending) return;
  pending = true;
  scheduleFrame(runScheduledFlush);
}

function runScheduledFlush() {
  runsThisFlush = 0;
  try {
    flushEffects();
  } finally {
    pending = false;
    if (queued.size > 0) {
      pending = true;
      scheduleFrame(runScheduledFlush);
    }
  }
}

function flushEffects() {
  if (queued.size === 0) return;
  flushCount++;
  while (queued.size > 0) {
    const list = [...queued];
    queued.clear();
    for (const e of list) {
      if (++runsThisFlush > MAX_EFFECT_RUNS_PER_FLUSH) {
        console.error(
          '[m] effect run cap hit — possible infinite loop; stopping flush',
        );
        queued.clear();
        return;
      }
      try {
        effectCount++;
        e();
      } catch (err) {
        console.error('[m] effect error', err);
      }
    }
  }
}

export function flushSync() {
  if (queued.size === 0 && !pending) return;
  pending = false;
  runsThisFlush = 0;
  flushEffects();
  if (queued.size > 0 && !pending) {
    pending = true;
    scheduleFrame(runScheduledFlush);
  }
}

/**
 * Plain data that is safe to deep-proxy (POJOs + arrays).
 * Skip host objects (DOM, Date, Promise, …) so we never break identity.
 */
export function canReactive(v) {
  if (v == null || typeof v !== 'object') return false;
  if (v[REACTIVE]) return true;
  if (proxyMap.has(v)) return true;
  if (Array.isArray(v)) return true;
  if (v instanceof Date || v instanceof RegExp || v instanceof Promise) {
    return false;
  }
  if (typeof Node !== 'undefined' && v instanceof Node) return false;
  const tag = Object.prototype.toString.call(v);
  return tag === '[object Object]';
}

/**
 * Deep reactive proxy. Nested POJOs/arrays are wrapped on read/write so
 * mutations like `store.history.unshift(row)` or `msg.text += chunk` notify
 * subscribers — no manual bump/timers.
 */
export function reactive(target) {
  if (target == null || typeof target !== 'object') return target;
  if (target[REACTIVE]) return target;
  const existing = proxyMap.get(target);
  if (existing) return existing;
  if (!canReactive(target)) return target;

  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === REACTIVE) return true;
      if (key === RAW) return obj;
      track(obj, key);
      const val = Reflect.get(obj, key, receiver);
      // Bind methods once and cache (avoid new function identity every get).
      // Always bind to *this* reactive proxy — not `receiver`. Nested scopes
      // use Object.create(proxy); binding to receiver would make `this.foo = …`
      // write onto the child scope instead of the store.
      if (
        typeof val === 'function' &&
        Object.prototype.hasOwnProperty.call(obj, key)
      ) {
        let cache = boundMethodCache.get(obj);
        if (!cache) {
          cache = new Map();
          boundMethodCache.set(obj, cache);
        }
        if (!cache.has(key)) cache.set(key, val.bind(proxy));
        return cache.get(key);
      }
      if (canReactive(val)) return reactive(val);
      return val;
    },
    set(obj, key, value) {
      const prev = obj[key];
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const prevLen = Array.isArray(obj) ? obj.length : null;
      const next =
        canReactive(value) && !value[REACTIVE] ? reactive(value) : value;
      const rawNext =
        next && typeof next === 'object' && next[RAW] ? next[RAW] : next;
      // Write against the raw target (not `receiver`). Using the proxy as
      // receiver breaks Array.prototype mutators — length and index sets never
      // land on the underlying array, so subscribers never re-run.
      const ok = Reflect.set(obj, key, rawNext, obj);
      if (typeof value === 'function' || typeof prev === 'function') {
        boundMethodCache.get(obj)?.delete(key);
      }
      if (!Object.is(prev, rawNext)) trigger(obj, key);
      if (!had && !Array.isArray(obj)) trigger(obj, ITERATE_KEY);
      // Setting arr[i] auto-updates .length without a separate [[Set]].
      if (Array.isArray(obj) && prevLen !== null && obj.length !== prevLen) {
        trigger(obj, 'length');
      }
      return ok;
    },
    deleteProperty(obj, key) {
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const ok = Reflect.deleteProperty(obj, key);
      if (had) {
        trigger(obj, key);
        trigger(obj, ITERATE_KEY);
      }
      return ok;
    },
    ownKeys(obj) {
      track(obj, Array.isArray(obj) ? 'length' : ITERATE_KEY);
      return Reflect.ownKeys(obj);
    },
  });

  proxyMap.set(target, proxy);
  return proxy;
}

export function effect(fn) {
  const depSets = new Set();
  let stopped = false;
  const runner = () => {
    if (stopped) return;
    for (const s of depSets) s.delete(runner);
    depSets.clear();
    runner._deps = depSets;
    const prev = activeEffect;
    activeEffect = runner;
    try {
      fn();
    } finally {
      activeEffect = prev;
    }
  };
  runner();
  return () => {
    stopped = true;
    for (const s of depSets) s.delete(runner);
    depSets.clear();
  };
}

/**
 * Walk a scope chain for the outermost reactive proxy. Row scopes created by
 * x-for inherit from the parent raw object; method calls like remove(id) must
 * use the parent store as `this`, not the row.
 */
export function findReactiveRoot(scope) {
  let cur = scope;
  let best = null;
  const seen = new Set();
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    if (cur[REACTIVE]) {
      best = cur;
    } else {
      const proxied = proxyMap.get(cur);
      if (proxied) best = proxied;
    }
    const raw = cur[RAW] || cur;
    cur = Object.getPrototypeOf(raw);
  }
  return best || scope;
}
