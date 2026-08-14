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
  FragmentVNode,
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
  componentRegistry,
  createDataScope,
  evaluate,
  evaluateAction,
  stringify,
} from './scope.js';
import { effect, findReactiveRoot, RAW, reactive } from './reactive.js';

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

  // Default <slot> is replaced with the host's children (parent scope).
  if (ast.tag === 'slot') return buildSlot(ast, scope, ctx);

  // A bare <template> with no structural directive renders its children.
  if (ast.isTemplate) return buildFragment(ast.children, scope, ctx);

  if (ast.component) return buildComponent(ast, scope, ctx);
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
      : buildRepeatedHost(ast, rowScope, ctx);
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

/**
 * x-for on a bare element (not <template>) still honours x-component / x-data
 * / x-mount on that same node. Previously this always went through
 * buildElement and silently dropped those directives.
 */
function buildRepeatedHost(ast, scope, ctx) {
  if (ast.component) return buildComponent(ast, scope, ctx);
  if (ast.data) return buildDataComponent(ast, scope, ctx);
  if (ast.mount) return buildMount(ast, scope, ctx);
  return buildElement(ast, scope, ctx);
}

// ---------------------------------------------------------------------------
// x-component → named widget; callee owns the template
// ---------------------------------------------------------------------------

/** Host attrs that are never treated as widget props. */
const HOST_RESERVED = new Set([
  'class', 'id', 'style', 'role', 'hidden', 'tabindex',
]);

function isReservedHostAttr(name) {
  if (!name) return true;
  if (HOST_RESERVED.has(name)) return true;
  return /^(aria|data)-/.test(name);
}

function hasSlotContent(astList) {
  if (!astList || !astList.length) return false;
  return astList.some((n) => n.kind !== 'text' || (n.text && /\S/.test(n.text)));
}

function buildSlot(ast, scope, ctx) {
  if (hasSlotContent(ctx?.slotAst)) {
    return buildFragment(ctx.slotAst, ctx.slotScope ?? scope, ctx.slotCtx ?? ctx);
  }
  return buildFragment(ast.children, scope, ctx);
}

function declaredProps(def) {
  if (!def) return null;
  if (Array.isArray(def.props)) return def.props;
  return null;
}

function collectComponentProps(def, ast, scope, ctx) {
  const declared = declaredProps(typeof def === 'function' ? null : def);
  const names = new Set(declared || []);

  if (!declared) {
    for (const k of Object.keys(ast.attrs || {})) {
      if (!isReservedHostAttr(k)) names.add(k);
    }
    for (const b of ast.binds || []) {
      if (b.arg && b.arg !== 'class' && b.arg !== 'style' && b.arg !== 'key') {
        names.add(b.arg);
      }
    }
  }

  const props = {};
  for (const name of names) {
    const bind = (ast.binds || []).find((b) => b.arg === name);
    if (bind) {
      props[name] = evaluate(bind.expression, scope, ctx);
    } else if (ast.attrs && Object.prototype.hasOwnProperty.call(ast.attrs, name)) {
      const raw = ast.attrs[name];
      props[name] = raw === '' ? true : raw;
    }
  }
  return props;
}

function collectForwarded(def, ast, scope, ctx) {
  const declared = declaredProps(typeof def === 'function' ? null : def);
  const isProp = (name) => (declared ? declared.includes(name) : !isReservedHostAttr(name));

  const attrs = {};
  for (const [k, v] of Object.entries(ast.attrs || {})) {
    if (isProp(k)) continue;
    attrs[k] = v;
  }

  const binds = [];
  for (const b of ast.binds || []) {
    if (!b.arg || b.arg === 'key') continue;
    if (isProp(b.arg)) continue;
    binds.push(b);
  }

  return {
    attrs,
    binds,
    on: ast.on ? ast.on.slice() : null,
    show: ast.show || null,
    model: ast.model || null,
    ref: ast.ref || null,
    init: ast.init || null,
    effects: ast.effects || null,
    cloak: ast.cloak || false,
    transition: ast.transition || null,
  };
}

function applyProps(target, props) {
  if (!target || !props) return;
  for (const [k, v] of Object.entries(props)) {
    if (target[k] !== v) target[k] = v;
  }
}

function instantiateWidget(def, props) {
  let data;
  if (typeof def === 'function') {
    data = def(props) || {};
  } else {
    data = Object.create(def);
  }
  applyProps(data, props);
  return reactive(data);
}

function widgetTemplate(def, scope) {
  if (scope?.template) return scope.template;
  if (def && typeof def === 'object' && def.template) return def.template;
  return '';
}

const widgetClasses = new Map();

function widgetClassFor(name) {
  let cls = widgetClasses.get(name);
  if (cls) return cls;

  cls = class WidgetComponent extends Component {
    oninit() {
      this.refs = {};
      this.ctx = {
        refs: this.refs,
        getEl: () => this.rootDom,
      };
      const def = componentRegistry.get(this.attrs.name) ?? this.attrs.def;
      this.scope = instantiateWidget(def, this.attrs.props);
      this.syncSlotCtx();
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

    syncSlotCtx() {
      this.ctx.slotAst = this.attrs.slotAst;
      this.ctx.slotScope = this.attrs.parentScope;
      this.ctx.slotCtx = this.attrs.slotCtx;
    }

    onbeforeupdate() {
      applyProps(this.scope, this.attrs.props);
      this.syncSlotCtx();
    }

    view() {
      this.syncSlotCtx();
      const def = componentRegistry.get(this.attrs.name) ?? this.attrs.def;
      const html = widgetTemplate(def, this.scope);
      const tree = buildTemplate(html, this.scope, this.ctx);
      const root = firstElementVNode(tree);
      if (root) {
        mergeForwardedOnto(root, this.attrs.forwarded, this.attrs.parentScope, this.attrs.slotCtx);
        const prev = root.oncreate;
        root.oncreate = (dom) => {
          this.rootDom = dom;
          prev?.(dom);
        };
      }
      return tree;
    }

    onremove() {
      if (typeof this.scope?.destroy === 'function') {
        try {
          this.scope.destroy();
        } catch (_) {}
      }
    }
  };

  Object.defineProperty(cls, 'name', { value: `x-component(${name})` });
  widgetClasses.set(name, cls);
  return cls;
}

function firstElementVNode(vnode) {
  if (!vnode) return null;
  if (vnode instanceof ElementVNode || vnode instanceof HTMLElementVNode || vnode instanceof RawHTMLVNode) {
    return vnode;
  }
  if (vnode instanceof FragmentVNode) {
    for (const k of vnode._keys || []) {
      const found = firstElementVNode(vnode._siblings[k]?.vnode);
      if (found) return found;
    }
  }
  return null;
}

function mergeForwardedOnto(root, forwarded, parentScope, parentCtx) {
  if (!root || !forwarded) return;
  const attrs = root.attrs || (root.attrs = {});

  for (const [k, v] of Object.entries(forwarded.attrs || {})) {
    if (k === 'class') mergeClass(attrs, v);
    else if (k === 'style') mergeStyle(attrs, v);
    else if (attrs[k] == null) attrs[k] = v;
  }

  if (forwarded.binds) {
    for (const b of forwarded.binds) {
      applyBind(attrs, b.arg || 'value', evaluate(b.expression, parentScope, parentCtx));
    }
  }

  if (forwarded.show) {
    applyShow(attrs, { show: forwarded.show, transition: forwarded.transition }, parentScope, parentCtx);
  }

  if (forwarded.model) {
    applyModel(attrs, { tag: root.tag, attrs }, forwarded.model, parentScope, parentCtx);
  }

  if (forwarded.on) {
    for (const o of forwarded.on) {
      const key = eventAttrName(o);
      const next = makeHandler(o, parentScope, parentCtx);
      const prev = attrs[key];
      attrs[key] = prev ? composeHandlers(prev, next) : next;
    }
  }

  if (forwarded.ref || forwarded.init || forwarded.effects) {
    const prevCreate = root.oncreate;
    const prevRebind = root.rebind;
    if (forwarded.init || forwarded.effects) {
      root.rebind = (box) => {
        prevRebind?.(box);
        box.parentScope = parentScope;
        box.parentCtx = parentCtx;
      };
    }
    root.oncreate = (dom) => {
      prevCreate?.(dom);
      if (forwarded.ref && parentCtx?.refs) parentCtx.refs[forwarded.ref] = dom;
      if (!forwarded.init && !forwarded.effects) return;
      const box = { parentScope, parentCtx: { ...parentCtx, getEl: () => dom } };
      root._hostBox = box;
      const stops = [];
      if (forwarded.init) {
        queueMicrotask(() =>
          evaluateAction(forwarded.init.expression, box.parentScope, {
            ...box.parentCtx,
            getEl: () => dom,
          }),
        );
      }
      if (forwarded.effects) {
        for (const e of forwarded.effects) {
          stops.push(
            effect(() =>
              evaluateAction(e.expression, box.parentScope, {
                ...box.parentCtx,
                getEl: () => dom,
              }),
            ),
          );
        }
      }
      const prevCleanup = root._cleanup;
      root._cleanup = () => {
        for (const s of stops) s();
        prevCleanup?.();
      };
    };
  }
}

function composeHandlers(a, b) {
  const both = function (e) {
    if (typeof a === 'function') a(e);
    if (typeof b === 'function') b(e);
  };
  both.toString = () => `${String(a)}+${String(b)}`;
  both.rebind = (live) => {
    a.rebind?.(a);
    b.rebind?.(b);
    live.toString = both.toString;
  };
  if (a.target) both.target = a.target;
  if (a.opts) both.opts = a.opts;
  return both;
}

function buildComponent(ast, scope, ctx) {
  const name = String(ast.component.expression || '').trim();
  const def = componentRegistry.get(name);
  if (!def) {
    console.warn('[m] unknown x-component', name);
    return buildElement({ ...ast, component: null }, scope, ctx);
  }

  const props = collectComponentProps(def, ast, scope, ctx);
  const forwarded = collectForwarded(def, ast, scope, ctx);

  return ComponentVNode._factory(widgetClassFor(name), {
    name,
    def,
    props,
    parentScope: scope,
    slotAst: ast.children,
    slotCtx: ctx,
    forwarded,
  });
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
