/**
 * m.js virtual DOM — reconciliation core.
 *
 * Ported from m.js v2 (M.mjs) with Flow annotations removed. The diff
 * algorithm, keyed sibling model, LIS reordering and attribute patching are
 * unchanged in behaviour; see PORT NOTES at the bottom for the handful of
 * genuine bugs fixed along the way.
 */

export const HTML_NS = 'http://www.w3.org/1999/xhtml';
export const SVG_NS = 'http://www.w3.org/2000/svg';
export const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

export const isFalsy = (v) => null == v || false === v;

export let DEBUG = false;

export function setDebug(on) {
  DEBUG = !!on;
}

/** Hooks queued during a diff, drained by M.redraw() once the tree is committed. */
export const delayedLifecycleEvents = [];

const prefixIfNotEmpty = (prefix, s) => (s.length < 1 ? '' : `${prefix}${s}`);

const selector = (o, tag, id, classList) =>
  tag +
  prefixIfNotEmpty('#', id ?? '') +
  prefixIfNotEmpty('.', classList?.trim().replace(/\s+/g, '.') ?? '');

const domToString = (e) =>
  `(${e?.constructor?.name ?? typeof e} ${selector(
    e,
    e?.nodeName ?? e?.constructor?.name ?? JSON.stringify(e),
    e?.id,
    Array.from(e?.classList ?? []).join(' '),
  )})`;

const insertion = (parent, vnode, dom, nextSibling) => {
  if (DEBUG) {
    console.debug(
      `insert ${vnode.toString()} parent=${domToString(parent)} nextSibling=${domToString(nextSibling)}`,
      { parent, dom, nextSibling },
    );
  }
  // NOTICE: type must be Node|null to avoid undefined behavior.
  parent.insertBefore(dom, nextSibling ?? null);
};

// ---------------------------------------------------------------------------
// FragmentVNode
// ---------------------------------------------------------------------------

/**
 * A minimal document object with no parent, holding a segment of tree
 * structure. Siblings are keyed so reorders and hide/show are detectable.
 */
export class FragmentVNode {
  static _empty(f) {
    if (f instanceof FragmentVNode) return f;
    const _this = new FragmentVNode();
    _this._siblings = {};
    _this._keys = [];
    _this._idxByKey = {};
    return _this;
  }

  static _factory(siblings) {
    const _this = FragmentVNode._empty();
    if (null == siblings) return _this;
    const keys = Object.keys(siblings);
    if (keys.length < 1) return _this;
    let i = 0;
    for (const sid of keys) {
      const vnode = siblings[sid];
      if (isFalsy(vnode)) continue;
      _this._keys.push(sid);
      _this._idxByKey[sid] = i;
      _this._siblings[sid] = { vnode, i };
      i++;
    }
    return _this;
  }

  get length() {
    return this._keys.length;
  }

  _is(b) {
    return b instanceof FragmentVNode;
  }

  _create() {
    this._df = new DocumentFragment();
  }

  _update() {
    this._create();
  }

  _insert(parent, old, nextSibling) {}

  _recurse(parent, old, nextSibling) {
    updateNodes(parent, old, this, nextSibling);
  }

  _delete(parent) {
    for (const { sibling } of this._reverseWalk()) {
      sibling.vnode._delete(parent);
    }
    this._df = new DocumentFragment();
    this._siblings = {};
    this._keys = [];
    this._idxByKey = {};
  }

  static _delete(f, parent) {
    if (isFalsy(f)) return;
    f._delete(parent);
  }

  *_reverseWalk() {
    for (let i = this._keys.length - 1; i >= 0; i--) {
      const sid = this._keys[i];
      const sibling = this._siblings[sid];
      yield { i, sid, sibling };
    }
  }

  _getNextSibling() {
    return this._siblings[this._keys[0]]?.vnode._getNextSibling();
  }

  toString() {
    return `(DocumentFragment)`;
  }
}

// ---------------------------------------------------------------------------
// TextVNode
// ---------------------------------------------------------------------------

export class TextVNode {
  static _factory(text) {
    if ('string' !== typeof text) return; // silently drop non-string
    if (text.length < 1) return; // silently drop empty

    const _this = new TextVNode();
    _this._text = text || '';
    return _this;
  }

  _is(b) {
    return b instanceof TextVNode;
  }

  _create() {
    this.dom = document.createTextNode(this._text);
    if (DEBUG) console.debug(`create ${this.toString()}`, this.dom);
  }

  _update(parent, old) {
    this.dom = old.dom;
    if (this._text !== old._text) {
      this.dom.textContent = this._text;
    }
  }

  _insert(parent, old, nextSibling) {
    insertion(parent, this, this.dom, nextSibling);
  }

  _recurse(parent, old, nextSibling) {}

  _delete(parent) {
    if (DEBUG) console.debug(`delete ${this.toString()}`, this.dom);
    parent?.removeChild(this.dom);
  }

  _getNextSibling() {
    return this;
  }

  toString() {
    return `(TextNode ${JSON.stringify(this._text)})`;
  }
}

// ---------------------------------------------------------------------------
// Element / HTMLElement
// ---------------------------------------------------------------------------

/**
 * Shared behaviour for the two attributable node types. Kept as a mixin
 * rather than a base class so each concrete class still reads like v2.
 */
const attributable = {
  _teardownForeign() {
    const list = this._foreign;
    if (!list) return;
    for (const { target, event, fn, opts } of list) {
      target.removeEventListener(event, fn, opts);
    }
    this._foreign = null;
  },
};

export class ElementVNode {
  static factory(ns, tag, attrs, children) {
    const _this = new ElementVNode();
    _this.ns = ns;
    _this.tag = tag;
    _this.attrs = attrs ?? {};
    _this.children = children;
    return _this;
  }

  _is(b) {
    return b instanceof ElementVNode && this.ns === b.ns && this.tag === b.tag;
  }

  _create() {
    this.dom = document.createElementNS(this.ns, this.tag);
    patchAttr(null, this);
    if (this.oncreate) delayedLifecycleEvents.push(() => this.oncreate(this.dom));
    if (DEBUG) console.debug(`create ${this.toString()}`, this.dom);
  }

  _update(parent, old) {
    this.dom = old.dom;
    this._foreign = old._foreign;
    this._cleanup = old._cleanup;
    this._box = old._box;
    if (this._box && this.rebind) this.rebind(this._box);
    patchAttr(old, this);
  }

  _insert(parent, old, nextSibling) {
    insertion(parent, this, this.dom, nextSibling);
  }

  _recurse(parent, old) {
    updateNodes(this.dom, old?.children, this.children, null);
  }

  _delete(parent) {
    FragmentVNode._delete(this.children, this.dom);
    this._cleanup?.();
    this._teardownForeign();
    if (DEBUG) console.debug(`delete ${this.toString()}`, this.dom);
    parent?.removeChild(this.dom);
  }

  _patchAttr(add, k, v) {
    // Only genuinely prefixed names (xlink:href, xml:lang) are namespaced;
    // plain SVG attributes like viewBox live in the null namespace.
    const ns = NS_BY_PREFIX[k.split(':')[0]];
    if (add) {
      if (ns) this.dom.setAttributeNS(ns, k, v);
      else this.dom.setAttribute(k, v);
    } else if (ns) {
      this.dom.removeAttributeNS(ns, k.split(':')[1]);
    } else {
      this.dom.removeAttribute(k);
    }
  }

  _getNextSibling() {
    return this;
  }

  toString() {
    return `(Element ns=${this.ns} ${selector(
      this.dom,
      this.dom?.nodeName,
      this.dom?.id,
      this.dom?.classList?.toString(),
    )})`;
  }
}

Object.assign(ElementVNode.prototype, attributable);

const NS_BY_PREFIX = {
  xlink: 'http://www.w3.org/1999/xlink',
  xml: 'http://www.w3.org/XML/1998/namespace',
};

export class HTMLElementVNode {
  static factory(tag, attrs, children) {
    const _this = new HTMLElementVNode();
    _this.tag = tag;
    _this.attrs = attrs ?? {};
    _this.children = children;
    return _this;
  }

  _is(b) {
    return b instanceof HTMLElementVNode && this.tag === b.tag;
  }

  _create() {
    this.dom = document.createElement(this.tag);
    patchAttr(null, this);
    if (this.oncreate) delayedLifecycleEvents.push(() => this.oncreate(this.dom));
    if (DEBUG) console.debug(`create ${this.toString()}`, this.dom);
  }

  _update(parent, old) {
    this.dom = old.dom;
    this._foreign = old._foreign;
    this._cleanup = old._cleanup;
    this._box = old._box;
    if (this._box && this.rebind) this.rebind(this._box);
    patchAttr(old, this);
  }

  _insert(parent, old, nextSibling) {
    insertion(parent, this, this.dom, nextSibling);
  }

  _recurse(parent, old) {
    updateNodes(this.dom, old?.children, this.children, null);
  }

  _delete(parent) {
    FragmentVNode._delete(this.children, this.dom);
    this._cleanup?.();
    this._teardownForeign();
    if (DEBUG) console.debug(`delete ${this.toString()}`, this.dom);
    parent?.removeChild(this.dom);
  }

  _patchAttr(add, k, v) {
    if (add) this.dom.setAttribute(k, v);
    else this.dom.removeAttribute(k);
  }

  _getNextSibling() {
    return this;
  }

  toString() {
    return `(HTMLElement ${selector(
      this.dom,
      this.dom?.nodeName,
      this.dom?.id,
      this.dom?.classList?.toString(),
    )})`;
  }
}

Object.assign(HTMLElementVNode.prototype, attributable);

// ---------------------------------------------------------------------------
// RawHTMLVNode — x-html. Foreign content; the diff never descends into it.
// ---------------------------------------------------------------------------

export class RawHTMLVNode {
  static factory(tag, attrs, html) {
    const _this = new RawHTMLVNode();
    _this.tag = tag;
    _this.attrs = attrs ?? {};
    _this.html = html ?? '';
    return _this;
  }

  _is(b) {
    return b instanceof RawHTMLVNode && this.tag === b.tag;
  }

  _create() {
    this.dom = document.createElement(this.tag);
    patchAttr(null, this);
    this.dom.innerHTML = this.html;
    if (this.oncreate) delayedLifecycleEvents.push(() => this.oncreate(this.dom));
  }

  _update(parent, old) {
    this.dom = old.dom;
    this._foreign = old._foreign;
    this._cleanup = old._cleanup;
    this._box = old._box;
    if (this._box && this.rebind) this.rebind(this._box);
    patchAttr(old, this);
    if (this.html !== old.html) this.dom.innerHTML = this.html;
  }

  _insert(parent, old, nextSibling) {
    insertion(parent, this, this.dom, nextSibling);
  }

  _recurse() {}

  _delete(parent) {
    this._cleanup?.();
    this._teardownForeign();
    parent?.removeChild(this.dom);
  }

  _patchAttr(add, k, v) {
    if (add) this.dom.setAttribute(k, v);
    else this.dom.removeAttribute(k);
  }

  _getNextSibling() {
    return this;
  }

  toString() {
    return `(RawHTML ${this.tag})`;
  }
}

Object.assign(RawHTMLVNode.prototype, attributable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class Component {
  oninit() {}
  onbeforeupdate() {}
  view() {}
  oncreate() {}
  onupdate() {}
  onbeforeremove() {}
  onremove() {}
}

export class ComponentVNode {
  static _factory(cls, attrs, children) {
    if (!('view' in (cls?.prototype ?? {}))) {
      throw Error(
        `component() param cls: expected Component class, ` +
          `got ${typeof cls} ${JSON.stringify(cls?.constructor?.name)}`,
      );
    }
    const _this = new ComponentVNode();
    _this.tag = cls?.name;
    _this.cls = cls;
    _this.instance = null;
    _this.attrs = attrs ?? {};
    _this._children = FragmentVNode._empty(children);
    return _this;
  }

  _is(b) {
    return b instanceof ComponentVNode && this.cls === b.cls;
  }

  _create() {
    if (DEBUG) console.debug(`create ${this.toString()}`, this);
    const inst = (this.instance = new this.cls());
    inst.tag = this.cls?.name;
    inst.state = {};
    inst.attrs = this.attrs ?? {};
    inst.children = FragmentVNode._empty(this._children);
    inst.oninit();
    // first-pass generate vnodes with undefined .dom
    const children = (this._vnode = autoDetect([inst.view()]));
    if (!isFalsy(children)) children._create();
    delayedLifecycleEvents.push(() => inst.oncreate());
  }

  _update(parent, old) {
    // pass state from old to new
    const inst = (this.instance = old.instance);
    this._vnode = old._vnode;
    if (null == inst) return; // shouldn't happen
    // overwrite (user-input params; should be treated as immutable)
    inst.attrs = this.attrs ?? {};
    inst.children = FragmentVNode._empty(this._children);

    // old nodes can refuse to update by returning false
    const outcome = inst.onbeforeupdate();
    if (false === outcome) return;

    // invoke view with defined .dom to re-generate and diff vnodes
    const children = (this._vnode = autoDetect([inst.view()]));
    if (!isFalsy(children)) children._update();
    delayedLifecycleEvents.push(() => inst.onupdate());
  }

  _insert(parent, old, nextSibling) {}

  _recurse(parent, old, nextSibling) {
    updateNodes(parent, old?._vnode, this._vnode, nextSibling);
  }

  _delete(parent) {
    const inst = this.instance;
    if (null == inst) return; // shouldn't happen
    inst.onbeforeremove();
    FragmentVNode._delete(this._vnode, parent);
    if (DEBUG) console.debug(`delete ${this.toString()}`, this);
    inst.onremove();
  }

  _getNextSibling() {
    if (isFalsy(this._vnode)) return;
    return this._vnode._getNextSibling();
  }

  toString() {
    const e = this.instance ?? this;
    return `(Component ${selector(e, e.tag, this.attrs?.id, this.attrs?.class)})`;
  }
}

// ---------------------------------------------------------------------------
// Sibling helpers
// ---------------------------------------------------------------------------

/**
 * Keyed siblings so it is easy to tell when they reorder or hide/show.
 */
export function volatile(siblings) {
  return FragmentVNode._factory(siblings);
}

/**
 * Ordered list of sibling VNodes.
 * NOTICE: You must NOT modify the ORDER or COUNT of VNodes in the list.
 */
export function fixed(...children) {
  const siblings = {};
  for (let i = 0, len = children.length; i < len; i++) {
    // WARNING: object keys are chronological only if they are strings that
    // don't resemble integers!
    siblings[`_${i}`] = children[i];
  }
  return FragmentVNode._factory(siblings);
}

export const autoDetect = (children) =>
  0 === children.length
    ? null
    : 1 === children.length && children[0] instanceof FragmentVNode
      ? children[0] // manual fragment
      : fixed(...children);

// ---------------------------------------------------------------------------
// The diff
// ---------------------------------------------------------------------------

export const updateNodes = (parent, oldFragment, newFragment, nextSibling) => {
  if (null == parent) return;
  const move = [];
  // create/update/delete elements and update attributes
  if (!isFalsy(newFragment)) {
    for (const { sid } of newFragment._reverseWalk()) {
      const newSibling = newFragment._siblings[sid];
      const oldSibling = isFalsy(oldFragment)
        ? null
        : oldFragment._siblings[sid];
      if (null == oldSibling) {
        // in new, not old; create
        if (!('_create' in newSibling.vnode)) {
          console.error('invalid vnode', newSibling.vnode);
        }
        newSibling.vnode?._create(parent);
      } else if (newSibling.vnode._is(oldSibling.vnode)) {
        // same tag; preserve state + update attrs. Only a reused node counts
        // as stable — see PORT NOTE 8 for why a replaced one must not.
        if (!isFalsy(oldFragment)) {
          move[oldFragment._idxByKey[sid]] = newFragment._idxByKey[sid];
        }
        newSibling.vnode._update(parent, oldSibling.vnode);
      } else {
        // different tag; discard state + create + set attrs
        oldSibling.vnode?._delete(parent);
        newSibling.vnode?._create(parent);
      }
    }
  }
  if (!isFalsy(oldFragment)) {
    for (const { sid } of oldFragment._reverseWalk()) {
      const oldSibling = oldFragment._siblings[sid];
      if (isFalsy(newFragment) || null == newFragment._idxByKey[sid]) {
        // in old, not new; remove
        oldSibling.vnode?._delete(parent);
      }
    }
  }
  if (!isFalsy(newFragment)) {
    const skip = longestIncreasingSubsequence(move);
    let lastDom = nextSibling;
    for (const { i, sid, sibling } of newFragment._reverseWalk()) {
      const oldSibling = isFalsy(oldFragment)
        ? null
        : oldFragment._siblings[sid];
      const newVNode = sibling.vnode;
      const oldVNode = oldSibling?.vnode;
      const next = lastDom;
      if (skip.has(i) && oldSibling != null) {
        newVNode._recurse(parent, oldVNode, next);
      } else {
        // NOTICE: this is the only point of recursion for create/update;
        // they only affect themselves, not children
        newVNode._insert(parent, oldVNode, next);
        newVNode._recurse(parent, oldVNode, next);
      }
      const v = newVNode._getNextSibling();
      lastDom = v?.dom ?? lastDom;
    }
  }
};

// ---------------------------------------------------------------------------
// Longest increasing subsequence (patience sorting), O(n log n)
// ---------------------------------------------------------------------------

export const longestIncreasingSubsequence = (a) => {
  const dp = [];
  let deepest = null;
  let start = 0;
  let end = 0;
  let mid = 0;
  for (let i = 0, l = a.length; i < l; i++) {
    if (a[i] == null || Number.isNaN(a[i])) continue;
    if (null == deepest || (deepest.target ?? 0) < (a[i] ?? 0)) {
      deepest = { target: a[i], idx: i, leaf: dp[dp.length - 1] };
      dp.push(deepest);
      continue;
    }

    start = 0;
    end = dp.length - 1;
    while (start < end) {
      mid = (start >>> 1) + (end >>> 1) + (start & end & 1);
      if ((dp[mid].target ?? 0) < (a[i] ?? 0)) start = mid + 1;
      else end = mid;
    }

    dp[start] = { target: a[i], idx: i, leaf: dp[start - 1] };

    if (start === dp.length - 1) deepest = dp[start];
  }
  let c = deepest;
  const results = new Set();
  while (null != c) {
    results.add(a[c.idx]);
    c = c.leaf;
  }
  return results;
};

// ---------------------------------------------------------------------------
// Attribute patching
// ---------------------------------------------------------------------------

/**
 * Attributes that must be written as DOM *properties*. Setting the attribute
 * does not move a user-dirtied control, so x-model would appear to do nothing.
 */
const PROPERTY_ATTRS = new Set([
  'value',
  'checked',
  'selected',
  'indeterminate',
  'muted',
  'volume',
]);

const isPropertyAttr = (dom, k) =>
  PROPERTY_ATTRS.has(k) &&
  (k !== 'value' ||
    dom.tagName === 'INPUT' ||
    dom.tagName === 'TEXTAREA' ||
    dom.tagName === 'SELECT' ||
    dom.tagName === 'OPTION' ||
    dom.tagName === 'PROGRESS');

/** Coerce an attribute value the way the DOM will see it. */
function normalizeAttrValue(k, v) {
  const type = typeof v;
  if ('number' === type || 'boolean' === type) v = String(v);
  else if ('string' !== type) v = '';
  if ('class' === k) v = String(v).trim();
  return v;
}

export const patchAttr = (oldVNode, newVNode) => {
  let k, v, ov;
  const apply = () => {
    if ('o' === k[0] && 'n' === k[1]) {
      applyListener(oldVNode, newVNode, k, v, ov);
      return;
    }
    if (isPropertyAttr(newVNode.dom, k)) {
      // Guard the write: reassigning an identical value resets the caret.
      const next = v == null || v === false ? '' : v === true ? true : v;
      if (k === 'checked' || k === 'selected' || k === 'indeterminate' ||
          k === 'muted') {
        const b = !!v && v !== 'false';
        if (newVNode.dom[k] !== b) newVNode.dom[k] = b;
      } else if (newVNode.dom[k] !== next) {
        newVNode.dom[k] = next;
      }
      return;
    }
    // Removal is driven by null/undefined/false — NOT by an empty string.
    // `data-editor`, `hidden`, `disabled` and friends are written valueless
    // in HTML and parse to "", so conflating the two silently deletes them.
    const drop = isFalsy(v);
    const next = drop ? '' : normalizeAttrValue(k, v);
    if (isFalsy(oldVNode)) {
      if (drop) return; // nothing to remove from a fresh element
    } else {
      // An unchanged attribute must not be re-written: redrawing with
      // unchanged state has to be a genuine no-op.
      const hadDrop = isFalsy(ov);
      if (hadDrop === drop && (drop || normalizeAttrValue(k, ov) === next)) {
        return;
      }
    }
    newVNode._patchAttr(!drop, k, next);
  };
  for (k in newVNode.attrs) {
    v = newVNode.attrs[k];
    ov = oldVNode?.attrs?.[k];
    apply();
  }
  if (isFalsy(oldVNode)) return;
  for (k in oldVNode.attrs) {
    if (!(k in newVNode.attrs)) {
      // PORT FIX: v2 re-ran _apply() here without resetting v/ov, so removal
      // re-applied the last *added* attribute's value instead of clearing.
      v = null;
      ov = oldVNode.attrs[k];
      apply();
    }
  }
};

/**
 * on* attributes. A handler may declare a foreign target (window / document)
 * via `fn.target`; those listeners are tracked on the vnode so _delete can
 * unregister them — the DOM node going away does not detach them.
 */
function applyListener(oldVNode, newVNode, k, v, ov) {
  // "onkeydown|enter" → "keydown"; the suffix only makes the key unique.
  const event = k.substr(2).split('|')[0];
  if (v == null) {
    if ('function' === typeof ov) unbind(newVNode, event, ov);
    return;
  }
  if (null == ov) {
    if ('function' === typeof v) bind(newVNode, event, v);
    return;
  }
  if ('function' === typeof ov && 'function' === typeof v) {
    // compare fn source, since the instances are different each time
    if (String(ov) !== String(v) || ov.target !== v.target) {
      unbind(newVNode, event, ov);
      bind(newVNode, event, v);
    } else {
      // Same shape — keep the live listener, but let it see fresh scope.
      if (v.rebind) v.rebind(ov);
    }
  }
}

function targetFor(vnode, fn) {
  if (fn.target === 'window') return typeof window !== 'undefined' ? window : null;
  if (fn.target === 'document')
    return typeof document !== 'undefined' ? document : null;
  return vnode.dom;
}

function bind(vnode, event, fn) {
  const target = targetFor(vnode, fn);
  if (!target) return;
  // A listener on window/document sees those as currentTarget, so remember
  // the element the directive was written on.
  fn.host = vnode.dom;
  const opts = fn.opts;
  target.addEventListener(event, fn, opts);
  if (fn.target) {
    (vnode._foreign ??= []).push({ target, event, fn, opts });
  }
}

function unbind(vnode, event, fn) {
  const target = targetFor(vnode, fn);
  if (!target) return;
  target.removeEventListener(event, fn, fn.opts);
  if (vnode._foreign) {
    vnode._foreign = vnode._foreign.filter((r) => r.fn !== fn);
  }
}

// ---------------------------------------------------------------------------
// PORT NOTES — deliberate deviations from m.js v2
// ---------------------------------------------------------------------------
//
// 1. _patchAttr removal loop reset v/ov. v2 re-invoked _apply() with the
//    variables still holding the previous iteration's values, so removing an
//    attribute wrote a stale value instead of clearing it.
// 2. ElementVNode._update called _patchAttr(this, old) — arguments swapped
//    relative to HTMLElementVNode. SVG nodes therefore diffed backwards and
//    kept stale attributes. Now _patchAttr(old, this) in both.
// 3. ElementVNode._patchAttr used setAttributeNS(this.ns, …) for every
//    attribute. Plain SVG attributes (viewBox, d, fill) belong to the null
//    namespace; only genuinely prefixed names (xlink:, xml:) are namespaced.
// 4. Property-valued attributes (value/checked/selected/…) are assigned as
//    DOM properties, guarded by an inequality check. Attribute writes do not
//    move a user-dirtied control, and unguarded writes reset the caret.
// 5. Foreign-target listeners (window/document) are tracked per vnode and
//    unregistered in _delete; v2 had no notion of them.
// 6. updateNodes only skips insertion for a stable node that actually existed
//    before (skip.has(i) && oldSibling != null) — a fresh node whose index
//    happens to land in the LIS still needs inserting.
// 7. lastDom falls back to the previous cursor when a vnode yields no DOM
//    (e.g. an empty fragment), instead of resetting the cursor to undefined.
// 8. The move map (input to the LIS) is now recorded only when _is() matched.
//    v2 recorded it for every shared key, so a sibling whose tag CHANGED was
//    still reported as part of the stable subsequence — its freshly created
//    replacement then took the _recurse-only branch and was never inserted.
//    Toggling <div x-if> into a slot previously held by a <button> lost the
//    node entirely.
// 9. Unchanged attributes are no longer re-written. v2 called setAttribute for
//    every attribute on every pass; harmless in isolation, but it means a
//    redraw with unchanged state still performs DOM work, which is exactly the
//    property this port exists to provide.
// 10. An empty string no longer means "remove the attribute". v2 decided
//    removal with `'' !== v`, but valueless HTML attributes (data-editor,
//    hidden, disabled, alt="") parse to "" — so every one of them was
//    silently dropped from the rendered output. Removal is now driven by
//    null / undefined / false only.
