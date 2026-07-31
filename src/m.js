/**
 * m.js v3 — Alpine-compatible UI runtime.
 *
 * Supports Alpine.js directives (x-*), magics ($*), and methods:
 *   x-data, x-bind, x-on, x-text, x-html, x-model, x-show, x-transition,
 *   x-for, x-if, x-init, x-effect, x-ref, x-cloak, x-ignore
 *   $store, $el, $dispatch, $watch, $refs, $nextTick
 *   M.data / M.store
 *
 * Shorthands: @click → x-on:click,  :class → x-bind:class
 * m-* aliases still work for compatibility.
 *
 * Plus m.js extras: Router, redraw/deferredBatchRedraw, HMR-safe stores.
 */

import { Router } from './router.js';
import { createStore as createZustandStore } from './store.js';

const VERSION = '3.0.0';
const DEBUG = false;

// ---------------------------------------------------------------------------
// Reactive engine (effect-based, Alpine-like)
// ---------------------------------------------------------------------------

const REACTIVE = Symbol('m.reactive');
const RAW = Symbol('m.raw');

/** raw object → proxy (so we never double-wrap) */
const proxyMap = new WeakMap();
/** raw object → cached bound methods */
const boundMethodCache = new WeakMap();

/** @type {Function | null} */
let activeEffect = null;
/** @type {WeakMap<object, Map<string|symbol, Set<Function>>>} */
const deps = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  // Never track internal symbols
  if (key === REACTIVE || key === RAW) return;
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
  const byKey = deps.get(target);
  if (!byKey) return;
  const effects = new Set();
  const exact = byKey.get(key);
  if (exact) for (const e of exact) effects.add(e);
  // Array mutation: length changes should refresh length subscribers only.
  // Do NOT fan-out every string key write to "iterate" subscribers — that
  // caused a hot loop when evaluate() used Object.keys() on the proxy.
  if (key === 'length') {
    const iter = byKey.get(Symbol.iterator);
    if (iter) for (const e of iter) effects.add(e);
  }
  for (const e of effects) scheduleEffect(e);
}

/** @type {Set<Function>} */
const queued = new Set();
let flushScheduled = false;
/** Safety: max effect runs per flush cycle before we bail */
const MAX_EFFECT_RUNS_PER_FLUSH = 1000;
let runsThisFlush = 0;

function scheduleEffect(e) {
  queued.add(e);
  if (!flushScheduled) {
    flushScheduled = true;
    runsThisFlush = 0;
    queueMicrotask(flushEffects);
  }
}

function flushEffects() {
  flushScheduled = false;
  // Drain in waves so newly scheduled work still runs, but cap total runs
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
        e();
      } catch (err) {
        console.error('[m] effect error', err);
      }
    }
  }
}

/**
 * @param {object} target
 * @returns {any}
 */
export function reactive(target) {
  if (target == null || typeof target !== 'object') return target;
  // Already a proxy?
  if (target[REACTIVE]) return target;
  // Already wrapped this raw object?
  const existing = proxyMap.get(target);
  if (existing) return existing;

  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === REACTIVE) return true;
      if (key === RAW) return obj;
      track(obj, key);
      const val = Reflect.get(obj, key, receiver);
      // Bind methods once and cache (avoid new function identity every get).
      // Always bind to *this* reactive proxy — not `receiver`.
      // x-for / nested scopes use Object.create(proxy); lookups then hit this
      // trap with receiver === childScope. Binding to receiver would make
      // `this.foo = …` write onto the per-item scope instead of the store,
      // so sidebar history / shared state never updates (until full reload).
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
      return val;
    },
    set(obj, key, value, receiver) {
      const prev = obj[key];
      const ok = Reflect.set(obj, key, value, receiver);
      // Invalidate bound method cache if a function slot changes
      if (typeof value === 'function' || typeof prev === 'function') {
        boundMethodCache.get(obj)?.delete(key);
      }
      if (!Object.is(prev, value)) trigger(obj, key);
      return ok;
    },
    deleteProperty(obj, key) {
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const ok = Reflect.deleteProperty(obj, key);
      if (had) trigger(obj, key);
      return ok;
    },
    // Intentionally do NOT track ownKeys — Object.keys() during evaluate
    // used to subscribe every effect to every write. Fine-grained gets only.
  });

  proxyMap.set(target, proxy);
  return proxy;
}

/**
 * @param {Function} fn
 * @returns {Function} stop
 */
export function effect(fn) {
  /** @type {Set<Set<Function>>} */
  const depSets = new Set();
  let stopped = false;
  const runner = () => {
    if (stopped) return;
    // cleanup old deps
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

// ---------------------------------------------------------------------------
// Registries: data components + stores
// ---------------------------------------------------------------------------

/** @type {Map<string, Function>} */
const dataRegistry = new Map();

/** HMR-safe M.store bucket */
const STORE_HMR = '__M_ALPINE_STORES__';
/** Fallback when window is unavailable (tests / SSR) */
const localStoreBucket = new Map();

function storeBucket() {
  if (typeof window === 'undefined') return localStoreBucket;
  if (!window[STORE_HMR]) window[STORE_HMR] = new Map();
  return window[STORE_HMR];
}

/** @type {Record<string, any>} */
let storesRoot = null;

function getStoresRoot() {
  if (!storesRoot) {
    // rebuild from HMR bucket
    const raw = {};
    for (const [k, v] of storeBucket()) raw[k] = v;
    storesRoot = reactive(raw);
  }
  return storesRoot;
}

// ---------------------------------------------------------------------------
// Magics
// ---------------------------------------------------------------------------

/**
 * @param {Element} el
 * @param {object} data
 */
function buildMagics(el, data) {
  const magics = {
    get $el() {
      return el;
    },
    get $refs() {
      return collectRefs(closestRoot(el) || el);
    },
    get $store() {
      return getStoresRoot();
    },
    $dispatch(name, detail) {
      el.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true }),
      );
    },
    $watch(property, callback) {
      let prev = evaluate(property, data, el);
      return effect(() => {
        const next = evaluate(property, data, el);
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
  return magics;
}

/**
 * @param {Element} root
 */
function collectRefs(root) {
  /** @type {Record<string, Element>} */
  const refs = {};
  walk(root, (el) => {
    const name =
      el.getAttribute?.('x-ref') ||
      el.getAttribute?.('m-ref');
    if (name) refs[name] = el;
  });
  return refs;
}

// ---------------------------------------------------------------------------
// Evaluate expressions in component scope + magics
// ---------------------------------------------------------------------------

/**
 * Evaluate an expression against scope + Alpine magics.
 *
 * IMPORTANT: only property *gets* through the reactive proxy are tracked.
 * We must NOT Object.keys() the proxy (that used to subscribe every effect
 * to every subsequent write → infinite flush loop).
 *
 * @param {string} expr
 * @param {object} scope
 * @param {Element} [el]
 * @param {any} [$event]
 */
function evaluate(expr, scope, el, $event) {
  if (expr == null || expr === '') return undefined;
  try {
    const magics = el ? buildMagics(el, scope) : {};
    // $event as a plain own prop on magics bag
    if ($event !== undefined) magics.$event = $event;

    // Nested `with`: magics first (outer), then data scope (inner wins on clash).
    // Accessing `count` hits the reactive proxy get trap → fine-grained track.
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      '$scope',
      '$magics',
      `with ($magics) { with ($scope) { return (${expr}); } }`,
    );
    return fn(scope ?? {}, magics);
  } catch (err) {
    if (DEBUG) console.warn('[m] eval:', expr, err);
    return undefined;
  }
}

/**
 * Run statement(s) for events / x-init (not just expressions).
 */
function evaluateAction(expr, scope, el, $event) {
  if (!expr) return;
  try {
    const magics = el ? buildMagics(el, scope) : {};
    if ($event !== undefined) magics.$event = $event;
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      '$scope',
      '$magics',
      `with ($magics) { with ($scope) { ${expr} } }`,
    );
    fn(scope ?? {}, magics);
  } catch (err) {
    // Fallback: expression form
    try {
      evaluate(expr, scope, el, $event);
    } catch (err2) {
      if (DEBUG) console.warn('[m] action:', expr, err2);
    }
  }
}

// ---------------------------------------------------------------------------
// DOM walk helpers
// ---------------------------------------------------------------------------

/**
 * @param {Element|Node} el
 * @param {(el: Element) => void | false} cb  return false to skip children
 */
function walk(el, cb) {
  if (el.nodeType !== 1) return;
  const skip = cb(/** @type {Element} */ (el));
  if (skip === false) return;
  for (const child of [...el.children]) walk(child, cb);
}

/** @type {WeakMap<Element, object>} */
const elementData = new WeakMap();
/** @type {WeakMap<Element, Function[]>} */
const elementCleanups = new WeakMap();

function addCleanup(el, fn) {
  let list = elementCleanups.get(el);
  if (!list) {
    list = [];
    elementCleanups.set(el, list);
  }
  list.push(fn);
}

function cleanupEl(el) {
  walk(el, (node) => {
    const list = elementCleanups.get(node);
    if (list) {
      for (const fn of list) {
        try {
          fn();
        } catch (_) {}
      }
      elementCleanups.delete(node);
    }
    elementData.delete(node);
  });
}

function closestData(el) {
  let cur = el;
  while (cur) {
    if (elementData.has(cur)) return elementData.get(cur);
    cur = cur.parentElement;
  }
  return null;
}

function closestRoot(el) {
  let cur = el;
  let root = el;
  while (cur) {
    if (elementData.has(cur)) root = cur;
    if (
      cur.hasAttribute?.('x-data') ||
      cur.hasAttribute?.('m-data')
    )
      root = cur;
    cur = cur.parentElement;
  }
  return root;
}

// ---------------------------------------------------------------------------
// Directive utils
// ---------------------------------------------------------------------------

const DIR_ORDER = [
  'ignore',
  'ref',
  'data',
  'init',
  'for',
  'if',
  'model',
  'bind',
  'text',
  'html',
  'show',
  'transition',
  'on',
  'effect',
  'cloak',
];

function isDir(name) {
  return (
    name.startsWith('x-') ||
    name.startsWith('m-') ||
    name.startsWith('@') ||
    (name.startsWith(':') && name.length > 1)
  );
}

/**
 * Normalize attribute name → { type, arg, modifiers }
 * e.g. x-on:click.prevent → { type:'on', arg:'click', modifiers:['prevent'] }
 */
function parseDirective(attrName) {
  let name = attrName;
  if (name.startsWith('@')) {
    return {
      type: 'on',
      arg: name.slice(1).split('.')[0],
      modifiers: name.slice(1).split('.').slice(1),
      raw: attrName,
    };
  }
  if (name.startsWith(':') && !name.startsWith('::')) {
    return {
      type: 'bind',
      arg: name.slice(1).split('.')[0],
      modifiers: name.slice(1).split('.').slice(1),
      raw: attrName,
    };
  }
  // strip x- or m-
  if (name.startsWith('x-') || name.startsWith('m-')) name = name.slice(2);
  const [head, ...rest] = name.split(':');
  const type = head.split('.')[0];
  const typeMods = head.split('.').slice(1);
  const argPart = rest.join(':');
  const arg = argPart ? argPart.split('.')[0] : null;
  const argMods = argPart ? argPart.split('.').slice(1) : [];
  return {
    type,
    arg,
    modifiers: [...typeMods, ...argMods],
    raw: attrName,
  };
}

function dirPriority(type) {
  const i = DIR_ORDER.indexOf(type);
  return i === -1 ? 100 : i;
}

// ---------------------------------------------------------------------------
// Apply bindings
// ---------------------------------------------------------------------------

function applyBinding(el, prop, result) {
  if (prop === 'class' || prop === 'className') {
    if (typeof result === 'object' && result && !Array.isArray(result)) {
      for (const [cls, on] of Object.entries(result)) {
        for (const token of String(cls).split(/\s+/).filter(Boolean)) {
          el.classList.toggle(token, !!on);
        }
      }
    } else if (Array.isArray(result)) {
      // merge with non-bound classes is hard; set all
      const staticCls = el.getAttribute('data-static-class') || '';
      el.setAttribute(
        'class',
        [staticCls, ...result.filter(Boolean)].filter(Boolean).join(' '),
      );
    } else if (result != null && result !== false) {
      const staticCls = el.getAttribute('data-static-class');
      if (staticCls != null) {
        el.setAttribute('class', `${staticCls} ${result}`.trim());
      } else {
        el.setAttribute('class', String(result));
      }
    }
  } else if (prop === 'style') {
    if (typeof result === 'object' && result) {
      Object.assign(/** @type {HTMLElement} */ (el).style, result);
    } else if (result != null) {
      el.setAttribute('style', String(result));
    }
  } else if (
    prop === 'disabled' ||
    prop === 'checked' ||
    prop === 'readonly' ||
    prop === 'required' ||
    prop === 'multiple' ||
    prop === 'selected'
  ) {
    /** @type {any} */ (el)[prop] = !!result;
    if (!result) el.removeAttribute(prop);
    else el.setAttribute(prop, '');
  } else if (prop === 'value') {
    if (/** @type {any} */ (el).value !== String(result ?? '')) {
      /** @type {any} */ (el).value = result ?? '';
    }
  } else if (result == null || result === false) {
    el.removeAttribute(prop);
  } else {
    el.setAttribute(prop, result === true ? '' : String(result));
  }
}

function stringify(v) {
  if (v == null || v === false) return '';
  return String(v);
}

// ---------------------------------------------------------------------------
// Process a single element (directives)
// ---------------------------------------------------------------------------

/**
 * @param {Element} el
 * @param {object} [parentScope]
 * @returns {boolean} continue into children?
 */
function processElement(el, parentScope) {
  // x-ignore
  if (el.hasAttribute('x-ignore') || el.hasAttribute('m-ignore')) {
    return false;
  }

  // Collect directives
  const dirs = [];
  for (const attr of [...el.attributes]) {
    if (!isDir(attr.name)) continue;
    const parsed = parseDirective(attr.name);
    dirs.push({ ...parsed, expression: attr.value, attrName: attr.name });
  }
  dirs.sort((a, b) => dirPriority(a.type) - dirPriority(b.type));

  let scope = parentScope || closestData(el) || {};
  let skipChildren = false;

  for (const dir of dirs) {
    const { type, arg, modifiers, expression, attrName } = dir;

    // Remove directive attrs from DOM (cleaner inspect) except cloak until done
    if (type !== 'cloak' && type !== 'data') {
      // keep x-data for debugging optional — remove others
      if (type !== 'ref') el.removeAttribute(attrName);
    }

    switch (type) {
      case 'ignore':
        return false;

      case 'ref':
        // handled via collectRefs; leave attr
        break;

      case 'data': {
        scope = initData(el, expression, parentScope);
        break;
      }

      case 'init': {
        const stop = effect(() => {
          // run once-ish: x-init typically once; we run when deps change too if referenced
        });
        stop(); // don't keep
        queueMicrotask(() => evaluateAction(expression, scope, el));
        addCleanup(el, () => {});
        break;
      }

      case 'for': {
        // Hand off to processFor (clones get full directive processing via initTree).
        // Do not process remaining dirs on this node — it is removed from the DOM.
        processFor(el, expression, scope);
        return false;
      }

      case 'if': {
        processIf(el, expression, scope);
        return false;
      }

      case 'text': {
        const stop = effect(() => {
          el.textContent = stringify(evaluate(expression, scope, el));
        });
        addCleanup(el, stop);
        break;
      }

      case 'html': {
        const stop = effect(() => {
          el.innerHTML = stringify(evaluate(expression, scope, el));
        });
        addCleanup(el, stop);
        break;
      }

      case 'show': {
        const transition = dirs.some((d) => d.type === 'transition');
        const stop = effect(() => {
          const show = !!evaluate(expression, scope, el);
          applyShow(/** @type {HTMLElement} */ (el), show, transition);
        });
        addCleanup(el, stop);
        break;
      }

      case 'transition':
        // handled with x-show
        el.removeAttribute(attrName);
        break;

      case 'model': {
        processModel(el, expression, scope, modifiers);
        break;
      }

      case 'bind': {
        if (!el.hasAttribute('data-static-class') && el.className) {
          el.setAttribute('data-static-class', el.getAttribute('class') || '');
        }
        const prop = arg || 'value';
        const stop = effect(() => {
          applyBinding(el, prop, evaluate(expression, scope, el));
        });
        addCleanup(el, stop);
        break;
      }

      case 'on': {
        processOn(el, arg || 'click', expression, scope, modifiers);
        break;
      }

      case 'effect': {
        const stop = effect(() => {
          evaluateAction(expression, scope, el);
        });
        addCleanup(el, stop);
        break;
      }

      case 'cloak':
        el.removeAttribute(attrName);
        el.removeAttribute('x-cloak');
        el.removeAttribute('m-cloak');
        break;

      case 'mount': {
        // m.js extension: nest a { template, ... } component from scope
        // Reactive: re-mount when the bound value identity changes (e.g. init wireChildren)
        let mounted = null;
        const stop = effect(() => {
          const child = evaluate(expression, scope, el);
          if (!child) return;
          if (mounted !== child) {
            mounted = child;
            mountComponent(el, child);
          }
        });
        addCleanup(el, stop);
        break;
      }

      default:
        if (DEBUG) console.warn('[m] unknown directive', type);
    }
  }

  return !skipChildren;
}

/**
 * @param {Element} el
 * @param {string} expression
 * @param {object} [parentScope]
 */
function initData(el, expression, parentScope) {
  let data;
  const expr = expression.trim() === '' ? '{}' : expression.trim();

  // Named component: x-data="dropdown" or x-data="dropdown(args)"
  const named = expr.match(/^([A-Za-z_$][\w$]*)(\s*\(.*\))?$/);
  if (named && dataRegistry.has(named[1])) {
    const factory = dataRegistry.get(named[1]);
    if (named[2]) {
      // evaluate args with parent scope — named[2] is like "(a, b)"
      const args =
        evaluate(`([...${named[2]}])`, parentScope || {}, el) || [];
      data = factory(...args);
    } else {
      data = factory();
    }
  } else {
    data = evaluate(expr, parentScope || {}, el);
  }

  if (data == null || data === true) data = {};
  if (typeof data !== 'object') data = { value: data };

  // Inherit parent scope via prototype for nested x-data
  // Use raw target if parent is a proxy so prototype walks work cleanly
  if (parentScope) {
    const parentRaw = parentScope[RAW] || parentScope;
    Object.setPrototypeOf(data, parentRaw);
  }

  const proxy = reactive(data);
  elementData.set(el, proxy);

  // init() lifecycle if present
  if (typeof proxy.init === 'function') {
    queueMicrotask(() => {
      try {
        proxy.init();
      } catch (e) {
        console.error(e);
      }
    });
  }

  addCleanup(el, () => {
    if (typeof proxy.destroy === 'function') {
      try {
        proxy.destroy();
      } catch (_) {}
    }
  });

  return proxy;
}

function applyShow(el, show, withTransition) {
  if (withTransition) {
    if (show) {
      el.style.display = '';
      el.style.opacity = '0';
      el.offsetHeight; // reflow
      el.style.transition = 'opacity 150ms ease';
      el.style.opacity = '1';
    } else {
      el.style.transition = 'opacity 150ms ease';
      el.style.opacity = '0';
      const done = () => {
        if (el.style.opacity === '0') el.style.display = 'none';
        el.removeEventListener('transitionend', done);
      };
      el.addEventListener('transitionend', done);
      setTimeout(done, 160);
    }
  } else {
    el.style.display = show ? '' : 'none';
  }
}

function processModel(el, expression, scope, modifiers) {
  const tag = el.tagName;
  const type = el.getAttribute('type');

  const stop = effect(() => {
    const val = evaluate(expression, scope, el);
    if (tag === 'INPUT' && (type === 'checkbox' || type === 'radio')) {
      /** @type {HTMLInputElement} */ (el).checked = !!val;
    } else if (/** @type {any} */ (el).value !== stringify(val)) {
      /** @type {any} */ (el).value = stringify(val);
    }
  });
  addCleanup(el, stop);

  const event =
    modifiers.includes('lazy') || tag === 'SELECT' ? 'change' : 'input';

  const handler = (e) => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    let value;
    if (t.type === 'checkbox') value = t.checked;
    else if (t.type === 'number') value = t.value === '' ? null : Number(t.value);
    else value = t.value;
    if (modifiers.includes('number')) value = parseFloat(value);
    assignPath(scope, expression, value);
  };
  el.addEventListener(event, handler);
  addCleanup(el, () => el.removeEventListener(event, handler));
}

function assignPath(scope, path, value) {
  const trimmed = path.trim();
  // Alpine: x-model="$store.cart.qty"
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

function processOn(el, event, expression, scope, modifiers) {
  let target = el;
  let eventName = event;
  if (modifiers.includes('window')) target = window;
  if (modifiers.includes('document')) target = document;
  if (modifiers.includes('outside')) {
    // click outside
    const handler = (e) => {
      if (el.contains(/** @type {Node} */ (e.target))) return;
      run();
    };
    const run = () => evaluateAction(expression, scope, el, null);
    document.addEventListener('click', handler);
    addCleanup(el, () => document.removeEventListener('click', handler));
    return;
  }

  const handler = (e) => {
    if (modifiers.includes('prevent')) e.preventDefault();
    if (modifiers.includes('stop')) e.stopPropagation();
    if (modifiers.includes('once')) {
      target.removeEventListener(eventName, handler);
    }
    // method name only
    const expr = expression.trim();
    if (/^[A-Za-z_$][\w$]*$/.test(expr) && typeof scope[expr] === 'function') {
      scope[expr](e);
    } else {
      evaluateAction(expr, scope, el, e);
    }
  };

  const opts = {};
  if (modifiers.includes('passive')) opts.passive = true;
  if (modifiers.includes('capture')) opts.capture = true;

  let finalHandler = handler;
  if (modifiers.includes('debounce')) {
    let t;
    finalHandler = (e) => {
      clearTimeout(t);
      t = setTimeout(() => handler(e), 250);
    };
  }
  if (modifiers.includes('throttle')) {
    let locked = false;
    finalHandler = (e) => {
      if (locked) return;
      locked = true;
      handler(e);
      setTimeout(() => {
        locked = false;
      }, 250);
    };
  }

  target.addEventListener(eventName, finalHandler, opts);
  addCleanup(el, () => target.removeEventListener(eventName, finalHandler, opts));
}

/**
 * x-for="item in items" on an element (clones it). Prefer <template x-for>.
 */
function processFor(el, expression, scope) {
  const match = expression.match(
    /^\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*))?\s+in\s+(.+)$/,
  );
  if (!match) {
    console.warn('[m] bad x-for', expression);
    return;
  }
  const [, itemName, indexName, listExpr] = match;

  const isTemplate = el.tagName === 'TEMPLATE';
  const anchor = document.createComment(`x-for: ${expression}`);
  el.parentNode.insertBefore(anchor, el);
  el.remove();

  /** @type {Element[]} */
  let rendered = [];

  const stop = effect(() => {
    const list = evaluate(listExpr, scope, anchor.parentElement) || [];
    const items = Array.isArray(list) ? list : Object.entries(list);

    // teardown old
    for (const node of rendered) {
      cleanupEl(node);
      node.remove();
    }
    rendered = [];

    let insertAfter = anchor;
    for (let i = 0; i < items.length; i++) {
      const item = Array.isArray(list) ? items[i] : items[i][1];
      const key = Array.isArray(list) ? i : items[i][0];

      const childScope = Object.create(scope);
      childScope[itemName] = item;
      if (indexName) childScope[indexName] = Array.isArray(list) ? i : key;
      else childScope.$index = Array.isArray(list) ? i : key;

      let node;
      if (isTemplate) {
        const frag = /** @type {HTMLTemplateElement} */ (
          el
        ).content.cloneNode(true);
        // wrap multi-root in a span? process each child
        const wrap = document.createElement('div');
        wrap.appendChild(frag);
        // insert all children
        const kids = [...wrap.childNodes];
        for (const kid of kids) {
          insertAfter.parentNode.insertBefore(kid, insertAfter.nextSibling);
          insertAfter = /** @type {any} */ (kid);
          if (kid.nodeType === 1) {
            initTree(/** @type {Element} */ (kid), childScope);
            rendered.push(/** @type {Element} */ (kid));
          }
        }
      } else {
        node = /** @type {Element} */ (el.cloneNode(true));
        node.removeAttribute('x-for');
        node.removeAttribute('m-for');
        insertAfter.parentNode.insertBefore(node, insertAfter.nextSibling);
        insertAfter = node;
        initTree(node, childScope);
        rendered.push(node);
      }
    }
  });

  addCleanup(anchor.parentElement || document.body, stop);
}

function processIf(el, expression, scope) {
  const isTemplate = el.tagName === 'TEMPLATE';
  const anchor = document.createComment(`x-if: ${expression}`);
  el.parentNode.insertBefore(anchor, el);
  el.remove();

  /** @type {Element[]} */
  let nodes = [];

  const stop = effect(() => {
    const show = !!evaluate(expression, scope, anchor.parentElement);
    for (const n of nodes) {
      cleanupEl(n);
      n.remove();
    }
    nodes = [];
    if (!show) return;

    if (isTemplate) {
      const frag = /** @type {HTMLTemplateElement} */ (el).content.cloneNode(
        true,
      );
      const wrap = document.createElement('div');
      wrap.appendChild(frag);
      let insertAfter = anchor;
      for (const kid of [...wrap.childNodes]) {
        insertAfter.parentNode.insertBefore(kid, insertAfter.nextSibling);
        insertAfter = /** @type {any} */ (kid);
        if (kid.nodeType === 1) {
          initTree(/** @type {Element} */ (kid), scope);
          nodes.push(/** @type {Element} */ (kid));
        }
      }
    } else {
      const node = /** @type {Element} */ (el.cloneNode(true));
      node.removeAttribute('x-if');
      node.removeAttribute('m-if');
      anchor.parentNode.insertBefore(node, anchor.nextSibling);
      initTree(node, scope);
      nodes.push(node);
    }
  });

  addCleanup(anchor.parentElement || document.body, stop);
}

// ---------------------------------------------------------------------------
// initTree — M.start style
// ---------------------------------------------------------------------------

/**
 * @param {Element|Document} el
 * @param {object} [scope]
 */
export function initTree(el, scope) {
  const root = el === document ? document.body : /** @type {Element} */ (el);
  walk(root, (node) => {
    // If node has x-data, that becomes new scope
    const parentScope =
      scope || closestData(node.parentElement) || closestData(node) || {};
    const cont = processElement(node, elementData.get(node) || parentScope);
    // processElement may set elementData for x-data nodes
    // If node had x-data, children should use that scope — walk continues
    // with closestData finding it.
    return cont;
  });
}

/**
 * Destroy Alpine state under el.
 * @param {Element} el
 */
export function destroyTree(el) {
  cleanupEl(el);
}

// ---------------------------------------------------------------------------
// Component mount (template string factories) — bridges Router pages
// ---------------------------------------------------------------------------

/** @type {HTMLElement | null} */
let rootEl = null;
/** @type {Function | null} */
let rootFactory = null;
/** @type {object | null} */
let rootInstance = null;
/** @type {Map<string, object>} */
const instanceCache = new Map();
let renderCount = 0;
let alreadyRedrawing = false;
let deferredQueued = false;

/**
 * Normalize factory → { template, ...data }
 * @param {object|Function} configOrFactory
 * @param {object} [attrs]
 */
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

/**
 * Render a {template,...} component into el using x-* processing.
 * @param {Element} el
 * @param {object|Function} configOrFactory
 * @param {string} [cacheKey]
 */
function mountComponent(el, configOrFactory, cacheKey) {
  let instance =
    cacheKey && instanceCache.has(cacheKey)
      ? instanceCache.get(cacheKey)
      : null;
  const isNew = !instance;
  if (!instance) {
    instance = instantiate(configOrFactory);
    if (cacheKey) instanceCache.set(cacheKey, instance);
  }

  // Tear down previous alpine tree in el
  destroyTree(el);
  el.innerHTML = instance.template || '';

  // Root scope is the component instance — walk children with that scope.
  // If template root has x-data, that takes over; otherwise bind instance as scope.
  elementData.set(el, instance);
  for (const child of [...el.children]) {
    initTree(child, instance);
  }
  // Also process directives ON children that use parent scope (instance)

  if (isNew && typeof instance.init === 'function') {
    queueMicrotask(() => {
      try {
        instance.init();
      } catch (e) {
        console.error(e);
      }
    });
  }
  return instance;
}

function clearInstances() {
  for (const inst of instanceCache.values()) {
    if (typeof inst.destroy === 'function') {
      try {
        inst.destroy();
      } catch (_) {}
    }
  }
  instanceCache.clear();
  rootInstance = null;
}

// ---------------------------------------------------------------------------
// Public API (M.*)
// ---------------------------------------------------------------------------

export const M = {
  version: VERSION,
  reactive,
  effect,

  /**
   * Register a reusable data component.
   * M.data('dropdown', () => ({ open: false, toggle(){...} }))
   */
  data(name, factory) {
    dataRegistry.set(name, factory);
    return factory;
  },

  /**
   * Global reactive store.
   * M.store('name', { ... }) or M.store('name') to read.
   */
  store(name, value) {
    const bucket = storeBucket();
    const root = getStoresRoot();
    if (value === undefined) {
      return root[name];
    }
    // HMR: reuse existing reactive store object when re-registering
    if (bucket.has(name) && typeof value === 'object' && value) {
      const existing = bucket.get(name);
      // merge new methods onto existing state (keep data)
      for (const k of Object.keys(value)) {
        if (typeof value[k] === 'function') {
          existing[k] = value[k];
        } else if (!(k in existing)) {
          existing[k] = value[k];
        }
      }
      root[name] = existing;
      if (typeof existing.init === 'function') {
        /* already inited */
      }
      return existing;
    }
    const data = typeof value === 'function' ? value() : value;
    const proxy = reactive(data && typeof data === 'object' ? data : { value: data });
    bucket.set(name, proxy);
    root[name] = proxy;
    if (typeof proxy.init === 'function') {
      queueMicrotask(() => proxy.init());
    }
    return proxy;
  },

  /**
   * Start M on the document (or under a root) — init all x-* trees.
   */
  start(root = document) {
    // CSS for x-cloak
    if (typeof document !== 'undefined' && !document.getElementById('m-cloak-style')) {
      const s = document.createElement('style');
      s.id = 'm-cloak-style';
      s.textContent = '[x-cloak],[m-cloak]{display:none !important;}';
      document.head.appendChild(s);
    }
    initTree(root === document ? document.body : root);
  },

  initTree,
  destroyTree,

  // m.js extras
  Router,
  createStore: createZustandStore,

  /**
   * Mount a root component factory (Router-friendly).
   * @param {HTMLElement|string|null} el
   * @param {Function|object} [factory]
   */
  mount(el, factory) {
    rootEl =
      typeof el === 'string' ? document.querySelector(el) : el || document.body;
    rootFactory =
      factory != null
        ? typeof factory === 'function'
          ? factory
          : () => factory
        : () => Router.render();

    // cloak style
    if (!document.getElementById('m-cloak-style')) {
      const s = document.createElement('style');
      s.id = 'm-cloak-style';
      s.textContent = '[x-cloak],[m-cloak]{display:none !important;}';
      document.head.appendChild(s);
    }

    Router.onChange(() => {
      clearInstances();
      M.deferredBatchRedraw();
    });
    Router.start();
    M.redraw();
    return rootInstance;
  },

  unmount() {
    if (rootEl) {
      destroyTree(rootEl);
      rootEl.replaceChildren();
    }
    clearInstances();
    rootEl = null;
    rootFactory = null;
    Router.stop();
  },

  redraw() {
    if (alreadyRedrawing) return;
    alreadyRedrawing = true;
    try {
      if (!rootEl || !rootFactory) return;

      const active = document.activeElement;
      const hadFocus =
        active && rootEl.contains(active)
          ? {
              name: /** @type {any} */ (active).name,
              id: active.id,
              start: /** @type {any} */ (active).selectionStart,
              end: /** @type {any} */ (active).selectionEnd,
            }
          : null;

      if (!rootInstance) {
        rootInstance = instantiate(rootFactory());
        instanceCache.set('root', rootInstance);
      }

      destroyTree(rootEl);
      rootEl.innerHTML = rootInstance.template || '';
      elementData.set(rootEl, rootInstance);
      for (const child of [...rootEl.children]) {
        initTree(child, rootInstance);
      }

      if (typeof rootInstance.init === 'function' && !rootInstance._inited) {
        rootInstance._inited = true;
        queueMicrotask(() => {
          try {
            rootInstance.init();
          } catch (e) {
            console.error(e);
          }
        });
      }

      if (hadFocus) {
        const next = hadFocus.id
          ? rootEl.querySelector(`#${CSS.escape(hadFocus.id)}`)
          : hadFocus.name
            ? rootEl.querySelector(`[name="${hadFocus.name}"]`)
            : null;
        if (next && /** @type {any} */ (next).focus) {
          /** @type {HTMLElement} */ (next).focus();
          if (
            hadFocus.start != null &&
            'setSelectionRange' in next
          ) {
            try {
              /** @type {any} */ (next).setSelectionRange(
                hadFocus.start,
                hadFocus.end,
              );
            } catch (_) {}
          }
        }
      }

      renderCount++;
    } finally {
      alreadyRedrawing = false;
    }
  },

  deferredBatchRedraw() {
    if (deferredQueued) return;
    deferredQueued = true;
    queueMicrotask(() => {
      deferredQueued = false;
      M.redraw();
    });
  },

  invalidate() {
    clearInstances();
  },

  get renderCount() {
    return renderCount;
  },
  get root() {
    return rootInstance;
  },

  link: Router.link,
  evaluate,
  magic: {
    // for extension
  },
};

// Aliases
export default M;

// Global for browser apps / console
if (typeof window !== 'undefined') {
  window.M = M;
  window.m = M;
}
