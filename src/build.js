/**
 * m.js VNode builder — static AST + scope → VNodes.
 *
 * Every directive is an expression evaluated here, during tree construction.
 * Nothing in this file touches the DOM; the resulting VNodes are handed to
 * the diff, which decides what actually changes.
 */

import {
  Component,
  ComponentVNode,
  ElementVNode,
  HTMLElementVNode,
  RawHTMLVNode,
  TextVNode,
  HTML_NS,
  autoDetect,
  fixed,
  volatile,
} from './vdom.js';
import { parseTemplate } from './parse.js';
import {
  assignPath,
  createDataScope,
  evaluate,
  evaluateAction,
  stringify,
} from './scope.js';
import { effect, findReactiveRoot, RAW } from './reactive.js';

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

const BOOLEAN_ATTRS = new Set([
  'disabled', 'readonly', 'required', 'hidden', 'multiple', 'open',
  'autofocus', 'autoplay', 'controls', 'default', 'defer', 'ismap', 'loop',
  'novalidate', 'reversed', 'async', 'inert',
]);

/** Attributes handled as DOM properties by the diff. */
const PROPERTY_ATTRS = new Set(['value', 'checked', 'selected', 'indeterminate']);

function splitClassTokens(s) {
  return String(s || '').split(/\s+/).filter(Boolean);
}

function classToString(value) {
  if (value == null || value === false) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(classToString).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, on]) => !!on)
      .map(([k]) => k)
      .join(' ');
  }
  return String(value);
}

function styleToString(value) {
  if (value == null || value === false) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  return Object.entries(value)
    .filter(([, v]) => v != null && v !== false && v !== '')
    .map(([k, v]) => `${kebab(k)}:${v}`)
    .join(';');
}

function kebab(k) {
  return k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function mergeClass(attrs, extra) {
  const add = splitClassTokens(classToString(extra));
  if (!add.length) return;
  const have = splitClassTokens(attrs.class);
  const seen = new Set(have);
  for (const t of add) if (!seen.has(t)) { have.push(t); seen.add(t); }
  attrs.class = have.join(' ');
}

function mergeStyle(attrs, extra) {
  const add = styleToString(extra);
  if (!add) return;
  const base = String(attrs.style || '').trim().replace(/;$/, '');
  attrs.style = base ? `${base};${add}` : add;
}

/** Apply one x-bind / :attr result onto the attribute bag. */
function applyBind(attrs, prop, value) {
  if (prop === 'class' || prop === 'className') return mergeClass(attrs, value);
  if (prop === 'style') return mergeStyle(attrs, value);
  if (PROPERTY_ATTRS.has(prop)) { attrs[prop] = value; return; }
  if (BOOLEAN_ATTRS.has(prop)) {
    if (value) attrs[prop] = prop;
    else delete attrs[prop];
    return;
  }
  if (value == null || value === false) { delete attrs[prop]; return; }
  if (value === true) { attrs[prop] = prop; return; }
  attrs[prop] = String(value);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

const EVENT_KEY_ALIASES = {
  enter: 'Enter',
  escape: 'Escape',
  space: ' ',
  tab: 'Tab',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  delete: ['Backspace', 'Delete'],
};

function matchesEventModifiers(el, event, modifiers) {
  if (modifiers.includes('self') && event.target !== el) return false;
  for (const modifier of ['ctrl', 'shift', 'alt', 'meta']) {
    if (modifiers.includes(modifier) && !event[`${modifier}Key`]) return false;
  }
  const wantedKeys = modifiers
    .filter((modifier) => Object.hasOwn(EVENT_KEY_ALIASES, modifier))
    .flatMap((modifier) => EVENT_KEY_ALIASES[modifier]);
  return wantedKeys.length === 0 || wantedKeys.includes(event.key);
}

/**
 * Build a listener whose identity is stable across redraws.
 *
 * The diff compares String(fn); we override toString() with a key derived
 * from the directive source so an unchanged binding keeps its live listener
 * and only has its captured scope refreshed (via rebind).
 */
function makeHandler(dir, scope, ctx) {
  const { arg, modifiers, expression } = dir;
  const outside = modifiers.includes('outside');

  const handler = function (e) {
    const s = handler.$scope;
    const c = handler.$ctx;
    const el = handler.host ?? e.currentTarget;
    if (outside) {
      if (!el || el.contains(e.target)) return;
    } else {
      if (el && !matchesEventModifiers(el, e, modifiers)) return;
    }
    if (modifiers.includes('prevent')) e.preventDefault();
    if (modifiers.includes('stop')) e.stopPropagation();

    const local = { ...c, getEl: () => el };
    const expr = String(handler.$expr).trim();
    // Bare method reference — call it with the store as `this`.
    const bare = expr.match(/^[A-Za-z_$][\w$.]*$/);
    if (bare) {
      const fn = evaluate(expr, s, local);
      if (typeof fn === 'function') {
        fn.call(findReactiveRoot(s), e);
        return;
      }
    }
    evaluateAction(expr, s, local, e);
  };

  handler.$scope = scope;
  handler.$ctx = ctx;
  handler.$expr = expression;
  // Identity key for the diff: different source ⇒ rebind, same ⇒ keep.
  const key = `m:on:${arg}:${modifiers.join('.')}:${expression}`;
  handler.toString = () => key;
  handler.rebind = (live) => {
    live.$scope = handler.$scope;
    live.$ctx = handler.$ctx;
    live.$expr = handler.$expr;
  };
  if (modifiers.includes('window')) handler.target = 'window';
  else if (modifiers.includes('document') || outside) handler.target = 'document';
  if (modifiers.includes('once')) handler.opts = { once: true };
  if (modifiers.includes('passive')) {
    handler.opts = { ...(handler.opts || {}), passive: true };
  }
  if (modifiers.includes('capture')) {
    handler.opts = { ...(handler.opts || {}), capture: true };
  }
  return handler;
}

/**
 * Attribute key for a listener. Several directives can target the same event
 * (@keydown.enter + @keydown.escape), so the key carries the modifiers too —
 * the diff strips everything after "|" to recover the event name.
 */
function eventAttrName(dir) {
  const outside = dir.modifiers.includes('outside');
  const event = outside ? 'click' : dir.arg || 'click';
  const mods = dir.modifiers.join('.');
  return mods ? `on${event}|${mods}` : `on${event}`;
}

// ---------------------------------------------------------------------------
// x-model
// ---------------------------------------------------------------------------

function applyModel(attrs, ast, dir, scope, ctx) {
  const type = ast.attrs.type;
  const isCheckbox = ast.tag === 'input' && (type === 'checkbox' || type === 'radio');
  const value = evaluate(dir.expression, scope, ctx);

  if (isCheckbox) attrs.checked = !!value;
  else attrs.value = stringify(value);

  const eventName =
    dir.modifiers.includes('lazy') || ast.tag === 'select' ? 'change' : 'input';

  const handler = function (e) {
    const t = e.target;
    let next;
    if (t.type === 'checkbox') next = t.checked;
    else if (t.type === 'number') next = t.value === '' ? null : Number(t.value);
    else next = t.value;
    if (dir.modifiers.includes('number')) next = parseFloat(next);
    if (dir.modifiers.includes('trim') && typeof next === 'string') {
      next = next.trim();
    }
    assignPath(handler.$scope, handler.$expr, next);
  };
  handler.$scope = scope;
  handler.$expr = dir.expression;
  const key = `m:model:${eventName}:${dir.expression}`;
  handler.toString = () => key;
  handler.rebind = (live) => {
    live.$scope = handler.$scope;
    live.$expr = handler.$expr;
  };
  attrs[`on${eventName}`] = handler;
}

// ---------------------------------------------------------------------------
// x-show (+ x-transition)
// ---------------------------------------------------------------------------

function applyShow(attrs, ast, scope, ctx) {
  const show = !!evaluate(ast.show.expression, scope, ctx);
  if (!ast.transition) {
    if (!show) mergeStyle(attrs, 'display:none');
    return;
  }
  // Declarative fade. display:none cannot transition, so hide with
  // opacity + visibility and delay visibility until the fade completes.
  const ms = transitionMs(ast.transition);
  if (show) {
    mergeStyle(attrs, `opacity:1;visibility:visible;transition:opacity ${ms}ms ease`);
  } else {
    mergeStyle(
      attrs,
      `opacity:0;visibility:hidden;transition:opacity ${ms}ms ease,visibility 0s ${ms}ms`,
    );
  }
}

function transitionMs(dir) {
  const dur = dir.modifiers.find((m) => /^duration$/.test(m));
  if (dur) {
    const i = dir.modifiers.indexOf(dur);
    const n = parseInt(dir.modifiers[i + 1], 10);
    if (Number.isFinite(n)) return n;
  }
  return 150;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** Parse + build a template string in one step. */
export function buildTemplate(html, scope, ctx) {
  return buildFragment(parseTemplate(html), scope, ctx);
}

/**
 * Children are keyed by their position in the *AST*, not in the output. An
 * x-if that renders nothing leaves a hole rather than shifting every later
 * sibling's key — otherwise toggling a conditional would make each following
 * node look like a different element and rebuild it.
 */
export function buildFragment(astList, scope, ctx) {
  const siblings = {};
  for (let i = 0; i < astList.length; i++) {
    const v = buildNode(astList[i], scope, ctx);
    if (v != null && v !== false) siblings[`_${i}`] = v;
  }
  return volatile(siblings);
}

export function buildNode(ast, scope, ctx) {
  if (ast.kind === 'text') return TextVNode._factory(ast.text);

  // x-for is outermost: it produces a keyed fragment of repeated bodies.
  if (ast.for) return buildFor(ast, scope, ctx);

  // x-if drops the node entirely.
  if (ast.if && !evaluate(ast.if.expression, scope, ctx)) return null;

  // A bare <template> with no structural directive renders its children.
  if (ast.isTemplate) return buildFragment(ast.children, scope, ctx);

  if (ast.data) return buildDataComponent(ast, scope, ctx);
  if (ast.mount) return buildMount(ast, scope, ctx);

  return buildElement(ast, scope, ctx);
}

/** Object/function keys get a stable identity, the way a Map would give them. */
const objectKeyIds = new WeakMap();
let objectKeySeq = 0;

/**
 * Turn a :key value into a sibling id. The type is part of the id, so 1 and
 * '1' stay distinct — stringifying alone would report them as a duplicate and
 * hand the second row a position-derived key, costing it its identity on the
 * next reorder.
 */
function keyToSid(key) {
  if (key !== null && (typeof key === 'object' || typeof key === 'function')) {
    let id = objectKeyIds.get(key);
    if (id === undefined) objectKeyIds.set(key, (id = `o${++objectKeySeq}`));
    return `k:${id}`;
  }
  return `k:${typeof key}:${String(key)}`;
}

function buildFor(ast, scope, ctx) {
  const spec = ast.for;
  if (!spec) return null;
  const list = evaluate(spec.list, scope, ctx);
  const rows = normalizeList(list);
  const parent = scope ?? {};
  const siblings = {};
  const seen = new Map();

  rows.forEach(([item, index], i) => {
    const locals = { $index: i };
    if (spec.destr) {
      const names = spec.destr;
      const isArrayDestr = spec.destrRaw?.startsWith('[');
      if (isArrayDestr) {
        if (Array.isArray(item)) {
          for (let di = 0; di < names.length; di++) locals[names[di]] = item[di];
        } else if (item != null && typeof item === 'object') {
          // For array destr on object entries: item is value, index is key — already handled
          for (let di = 0; di < names.length; di++) locals[names[di]] = item[di];
        } else {
          for (const n of names) locals[n] = undefined;
        }
      } else {
        // Object destructuring: {a, b} — item is the object
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          for (const n of names) locals[n] = item[n];
        } else {
          for (const n of names) locals[n] = undefined;
        }
      }
      if (!locals[spec.item] && names.length) locals[spec.item] = item;
    } else {
      locals[spec.item] = item;
    }
    if (spec.index) locals[spec.index] = index;
    const rowScope = makeRowScope(parent, locals);

    const key = ast.key
      ? evaluate(ast.key.expression, rowScope, ctx)
      : index;
    const base = keyToSid(key);
    const dup = seen.get(base) || 0;
    seen.set(base, dup + 1);
    let sid = base;
    // Duplicate keys would silently collapse rows; disambiguate and warn.
    if (dup > 0) {
      console.warn('[m] duplicate x-for key', key, spec.raw);
      sid = `${base}#${dup}`;
    }

    const body = ast.isTemplate
      ? buildFragment(ast.children, rowScope, ctx)
      : buildElement(ast, rowScope, ctx);
    siblings[sid] = body;
  });

  return volatile(siblings);
}

/**
 * Row scope: locals shadow the parent, everything else delegates to the
 * parent *proxy*. Delegation (rather than prototype chaining) matters twice —
 * writing a local cannot leak into the parent's set trap, and reading an
 * inherited method returns it already bound to the store, so `remove(id)`
 * doing `this.items = …` mutates the store instead of the row.
 */
export function makeRowScope(parent, locals) {
  return new Proxy(locals, {
    has(t, k) {
      return k in t || (parent != null && k in parent);
    },
    get(t, k) {
      if (Object.prototype.hasOwnProperty.call(t, k)) return t[k];
      return parent?.[k];
    },
    set(t, k, v) {
      if (Object.prototype.hasOwnProperty.call(t, k) || parent == null) {
        t[k] = v;
        return true;
      }
      parent[k] = v;
      return true;
    },
  });
}

function normalizeList(list) {
  if (list == null) return [];
  if (Array.isArray(list)) return list.map((v, i) => [v, i]);
  if (typeof list === 'number') {
    return Array.from({ length: list }, (_, i) => [i + 1, i]);
  }
  if (typeof list[Symbol.iterator] === 'function') {
    return [...list].map((v, i) => [v, i]);
  }
  if (typeof list === 'object') {
    return Object.entries(list).map(([k, v]) => [v, k]);
  }
  return [];
}

// ---------------------------------------------------------------------------
// x-data → ComponentVNode (state survives redraws via _update)
// ---------------------------------------------------------------------------

function componentClassFor(ast) {
  if (ast._cls) return ast._cls;

  class DataComponent extends Component {
    oninit() {
      this.refs = {};
      this.ctx = { refs: this.refs, getEl: () => this.rootDom };
      this.scope = createDataScope(
        ast.data.expression,
        this.attrs.parentScope,
        this.ctx,
      );
      if (typeof this.scope.init === 'function') {
        queueMicrotask(() => {
          try {
            this.scope.init();
          } catch (e) {
            console.error(e);
          }
        });
      }
    }

    onbeforeupdate() {
      // Re-link the prototype so parent scope changes are visible.
      const parent = this.attrs.parentScope;
      if (parent) {
        const raw = this.scope[RAW] || this.scope;
        const parentRaw = parent[RAW] || parent;
        if (Object.getPrototypeOf(raw) !== parentRaw && raw !== parentRaw) {
          Object.setPrototypeOf(raw, parentRaw);
        }
      }
    }

    view() {
      const v = buildElement(ast, this.scope, this.ctx);
      if (v) {
        const prev = v.oncreate;
        v.oncreate = (dom) => {
          this.rootDom = dom;
          prev?.(dom);
        };
      }
      return v;
    }

    onremove() {
      if (typeof this.scope?.destroy === 'function') {
        try {
          this.scope.destroy();
        } catch (_) {}
      }
    }
  }

  Object.defineProperty(DataComponent, 'name', { value: `x-data(${ast.tag})` });
  ast._cls = DataComponent;
  return DataComponent;
}

function buildDataComponent(ast, scope, ctx) {
  return ComponentVNode._factory(componentClassFor(ast), { parentScope: scope });
}

// ---------------------------------------------------------------------------
// x-mount → nested { template, … } component
// ---------------------------------------------------------------------------

const mountClasses = new WeakMap();

function mountClassFor(config) {
  let cls = mountClasses.get(config);
  if (cls) return cls;
  cls = class MountComponent extends Component {
    oninit() {
      this.refs = {};
      this.ctx = { refs: this.refs, getEl: () => null };
      if (typeof this.attrs.config.init === 'function') {
        queueMicrotask(() => {
          try {
            this.attrs.config.init();
          } catch (e) {
            console.error(e);
          }
        });
      }
    }
    view() {
      const cfg = this.attrs.config;
      return buildTemplate(cfg.template || '', cfg, this.ctx);
    }
    onremove() {
      const cfg = this.attrs.config;
      if (typeof cfg?.destroy === 'function') {
        try {
          cfg.destroy();
        } catch (_) {}
      }
    }
  };
  mountClasses.set(config, cls);
  return cls;
}

function buildMount(ast, scope, ctx) {
  const config = evaluate(ast.mount.expression, scope, ctx);
  if (!config || typeof config !== 'object') return null;
  const host = buildElement({ ...ast, mount: null, children: [] }, scope, ctx);
  if (!host) return null;
  host.children = autoDetect([
    ComponentVNode._factory(mountClassFor(config[RAW] || config), { config }),
  ]);
  return host;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

function buildElement(ast, scope, ctx) {
  if (ast.ignore) {
    const v = RawHTMLVNode.factory(ast.tag, { ...ast.attrs }, ast.raw || '');
    return v;
  }

  const attrs = { ...ast.attrs };
  if (ast.cloak) delete attrs['x-cloak'];

  if (ast.binds) {
    for (const b of ast.binds) {
      applyBind(attrs, b.arg || 'value', evaluate(b.expression, scope, ctx));
    }
  }
  if (ast.show) applyShow(attrs, ast, scope, ctx);
  if (ast.model) applyModel(attrs, ast, ast.model, scope, ctx);
  if (ast.on) {
    for (const o of ast.on) {
      attrs[eventAttrName(o)] = makeHandler(o, scope, ctx);
    }
  }

  let vnode;
  if (ast.html) {
    const html = stringify(evaluate(ast.html.expression, scope, ctx));
    vnode = RawHTMLVNode.factory(ast.tag, attrs, html);
  } else {
    let children;
    if (ast.text) {
      const text = stringify(evaluate(ast.text.expression, scope, ctx));
      children = autoDetect([TextVNode._factory(text)]);
    } else {
      children = buildFragment(ast.children, scope, ctx);
    }
    vnode =
      ast.ns === HTML_NS
        ? HTMLElementVNode.factory(ast.tag, attrs, children)
        : ElementVNode.factory(ast.ns, ast.tag, attrs, children);
  }

  attachLifecycle(vnode, ast, scope, ctx);
  return vnode;
}

function attachLifecycle(vnode, ast, scope, ctx) {
  const needsBox = !!(ast.effects || ast.init);
  if (!ast.ref && !needsBox) return;

  if (needsBox) {
    // Effects and x-init close over a box the diff keeps refreshing, so a
    // live effect always sees the current scope rather than the one captured
    // when its element was created.
    vnode.rebind = (box) => {
      box.scope = scope;
      box.ctx = ctx;
    };
  }

  const prev = vnode.oncreate;
  vnode.oncreate = (dom) => {
    prev?.(dom);
    if (ast.ref) ctx.refs[ast.ref] = dom;
    if (!needsBox) return;

    const box = { scope, ctx: { ...ctx, getEl: () => dom } };
    vnode._box = box;
    const stops = [];
    if (ast.init) {
      queueMicrotask(() =>
        evaluateAction(ast.init.expression, box.scope, {
          ...box.ctx,
          getEl: () => dom,
        }),
      );
    }
    if (ast.effects) {
      for (const e of ast.effects) {
        stops.push(
          effect(() =>
            evaluateAction(e.expression, box.scope, {
              ...box.ctx,
              getEl: () => dom,
            }),
          ),
        );
      }
    }
    vnode._cleanup = () => {
      for (const s of stops) s();
    };
  };
}
