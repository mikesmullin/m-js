/*! m.js v3.2.2 | MIT | https://mikesmullin.github.io/m-js/ */

// src/router.js
var RX_ABSOLUTE_URL = /^(?:\w{1,99}:)?\/\//;
var routes = new Map;
var currentUri = "";
var basePath = "";
var mode = "path";
var formatTitle = null;
var onChange = null;
var params = {};
function normalizePath(uri) {
  let p = (uri || "/").split("?")[0].split("#")[0] || "/";
  if (!p.startsWith("/"))
    p = "/" + p;
  if (p.length > 1)
    p = p.replace(/\/+$/, "");
  return p || "/";
}
function stripBase(pathname) {
  let path = pathname || "/";
  if (basePath) {
    if (path === basePath || path === basePath + "/") {
      path = "/";
    } else if (path.startsWith(basePath + "/")) {
      path = path.slice(basePath.length) || "/";
    }
  }
  return normalizePath(path);
}
function withBase(uri) {
  const path = normalizePath(uri);
  if (!basePath)
    return path === "/" ? "/" : path;
  if (path === "/")
    return basePath + "/";
  return basePath + path;
}
function readLocation() {
  if (mode === "hash") {
    const raw = (window.location.hash || "").replace(/^#/, "");
    return normalizePath(raw || "/");
  }
  return stripBase(window.location.pathname || "/");
}
function locationFor(path) {
  if (mode === "hash") {
    return window.location.pathname + window.location.search + "#" + path;
  }
  return withBase(path);
}
function writeHistory(replace, url, title) {
  try {
    if (replace)
      window.history.replaceState(null, title || "", url);
    else
      window.history.pushState(null, title || "", url);
    return true;
  } catch (_) {
    return false;
  }
}
function currentLocation() {
  return mode === "hash" ? window.location.pathname + window.location.search + (window.location.hash || "#/") : window.location.pathname;
}

class Router {
  static get uri() {
    return currentUri;
  }
  static get mode() {
    return mode;
  }
  static setMode(next) {
    mode = next === "hash" ? "hash" : "path";
  }
  static get params() {
    return params;
  }
  static get base() {
    return basePath;
  }
  static setBase(base) {
    basePath = (base || "").replace(/\/+$/, "");
    if (basePath === "/")
      basePath = "";
  }
  static detectBase() {
    const basetag = document.querySelector("base[href]");
    if (basetag) {
      try {
        const u = new URL(basetag.href, location.origin);
        const dir = u.pathname.replace(/\/+$/, "");
        if (dir && dir !== "/") {
          Router.setBase(dir);
          return basePath;
        }
      } catch (_) {}
    }
    const scripts = document.querySelectorAll('script[type="module"][src], script[data-hmr-entry][src]');
    for (const s of scripts) {
      const src = s.getAttribute("src");
      if (!src || src.startsWith("data:"))
        continue;
      try {
        const u = new URL(src, location.href);
        if (u.origin !== location.origin)
          continue;
        const dir = u.pathname.replace(/\/[^/]*$/, "");
        if (dir && dir !== "/") {
          Router.setBase(dir);
          return basePath;
        }
      } catch (_) {}
    }
    if (/\.github\.io$/i.test(location.hostname)) {
      const parts = location.pathname.split("/").filter(Boolean);
      if (parts.length >= 1) {
        Router.setBase("/" + parts[0]);
        return basePath;
      }
    }
    Router.setBase("");
    return "";
  }
  static setTitleFormat(fn) {
    formatTitle = fn;
  }
  static onChange(fn) {
    onChange = fn;
  }
  static register(uri, title, fn) {
    const path = normalizePath(uri);
    const pattern = path.replace(/\//g, "\\/").replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "(?<$1>[^/]+)");
    routes.set(path, {
      uri: path,
      title,
      rx: new RegExp(`^${pattern}$`),
      fn
    });
  }
  static rewrite(from, to) {
    Router.register(from, "", () => {
      Router.set(to);
      return { template: "" };
    });
  }
  static match(uri) {
    const path = normalizePath(uri);
    for (const route of routes.values()) {
      const m = path.match(route.rx);
      if (m) {
        return {
          route,
          params: m.groups ? { ...m.groups } : {}
        };
      }
    }
    return null;
  }
  static get() {
    return currentUri;
  }
  static set(uri) {
    const path = normalizePath(uri);
    const matched = Router.match(path);
    if (!matched) {
      console.warn(`[m.Router] 404: ${path}`);
      currentUri = path;
      params = {};
      onChange?.();
      return;
    }
    currentUri = path;
    params = matched.params;
    let title = matched.route.title;
    if (typeof formatTitle === "function") {
      title = formatTitle(title);
    }
    if (typeof title === "string" && title) {
      document.title = title;
    }
    const full = locationFor(path);
    if (currentLocation() !== full) {
      if (mode === "hash")
        window.location.hash = path;
      else
        writeHistory(false, full, title);
    }
    onChange?.();
  }
  static render() {
    const matched = Router.match(currentUri);
    if (!matched) {
      return {
        template: `
          <div class="p-12 text-center">
            <h1 class="text-4xl font-bold text-pink-400 mb-4">404</h1>
            <p class="text-cyan-200/70 mb-6">No route for <code class="text-cyan-300">${escapeHtml(currentUri)}</code></p>
            <a href="${withBase("/")}" class="text-cyan-400 underline" @click="goHome">Go home</a>
          </div>
        `,
        goHome(e) {
          e.preventDefault();
          Router.set("/");
        }
      };
    }
    return matched.route.fn(params);
  }
  static _popstate() {
    if (readLocation() === currentUri)
      return;
    Router.syncFromLocation();
  }
  static syncFromLocation() {
    const path = readLocation();
    const matched = Router.match(path);
    currentUri = path;
    params = matched?.params ?? {};
    if (matched) {
      let title = matched.route.title;
      if (typeof formatTitle === "function")
        title = formatTitle(title);
      if (typeof title === "string" && title)
        document.title = title;
    }
    onChange?.();
  }
  static link(e) {
    const anchor = e.currentTarget || e.target;
    if (!anchor)
      return;
    const el = anchor.closest?.("a") || anchor;
    const href = el.getAttribute?.("href");
    if (href == null)
      return;
    if (RX_ABSOLUTE_URL.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    let appPath = href;
    if (mode === "hash") {
      appPath = href.startsWith("#") ? href.slice(1) || "/" : href;
    } else if (basePath && (href === basePath || href === basePath + "/" || href.startsWith(basePath + "/"))) {
      appPath = stripBase(href);
    }
    if (e.ctrlKey || e.metaKey) {
      window.open(window.location.origin + locationFor(normalizePath(appPath)));
    } else {
      Router.set(appPath);
    }
    return false;
  }
  static href(uri) {
    return mode === "hash" ? "#" + normalizePath(uri) : withBase(uri);
  }
  static start() {
    if (!basePath && mode === "path")
      Router.detectBase();
    window.addEventListener("popstate", Router._popstate, false);
    if (mode === "hash") {
      window.addEventListener("hashchange", Router._popstate, false);
    }
    const path = readLocation();
    const matched = Router.match(path);
    currentUri = path;
    params = matched?.params ?? {};
    if (matched) {
      let title = matched.route.title;
      if (typeof formatTitle === "function")
        title = formatTitle(title);
      if (typeof title === "string" && title)
        document.title = title;
      const full = locationFor(path);
      if (currentLocation() !== full) {
        if (!writeHistory(true, full, title) && mode === "hash") {
          window.location.hash = path;
        }
      }
    }
  }
  static stop() {
    window.removeEventListener("popstate", Router._popstate, false);
    window.removeEventListener("hashchange", Router._popstate, false);
  }
  static list() {
    return [...routes.keys()];
  }
  static reset() {
    mode = "path";
    routes.clear();
    currentUri = "";
    params = {};
  }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// src/store.js
var HMR_KEY = "__M_STORES__";
function getHmrBucket() {
  if (typeof window === "undefined")
    return null;
  if (!window[HMR_KEY])
    window[HMR_KEY] = new Map;
  return window[HMR_KEY];
}
function createStore(createState, opts = {}) {
  const name = opts.name || null;
  const bucket = getHmrBucket();
  if (name && bucket?.has(name)) {
    return bucket.get(name);
  }
  const listeners = new Set;
  let state;
  let initialState;
  const getState = () => state;
  const getInitialState = () => initialState;
  const setState = (partial, replace) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    if (Object.is(next, state))
      return;
    const prev = state;
    state = replace === true || typeof next !== "object" || next === null ? next : Object.assign({}, state, next);
    for (const listener of listeners)
      listener(state, prev);
  };
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const api = { setState, getState, getInitialState, subscribe };
  initialState = state = createState(setState, getState, api);
  if (name && bucket)
    bucket.set(name, api);
  return api;
}
function clearStore(name) {
  getHmrBucket()?.delete(name);
}

// src/vdom.js
var HTML_NS = "http://www.w3.org/1999/xhtml";
var SVG_NS = "http://www.w3.org/2000/svg";
var MATHML_NS = "http://www.w3.org/1998/Math/MathML";
var isFalsy = (v) => v == null || v === false;
var DEBUG = false;
function setDebug(on) {
  DEBUG = !!on;
}
var delayedLifecycleEvents = [];
var prefixIfNotEmpty = (prefix, s) => s.length < 1 ? "" : `${prefix}${s}`;
var selector = (o, tag, id, classList) => tag + prefixIfNotEmpty("#", id ?? "") + prefixIfNotEmpty(".", classList?.trim().replace(/\s+/g, ".") ?? "");
var domToString = (e) => `(${e?.constructor?.name ?? typeof e} ${selector(e, e?.nodeName ?? e?.constructor?.name ?? JSON.stringify(e), e?.id, Array.from(e?.classList ?? []).join(" "))})`;
var insertion = (parent, vnode, dom, nextSibling) => {
  if (DEBUG) {
    console.debug(`insert ${vnode.toString()} parent=${domToString(parent)} nextSibling=${domToString(nextSibling)}`, { parent, dom, nextSibling });
  }
  parent.insertBefore(dom, nextSibling ?? null);
};

class FragmentVNode {
  static _empty(f) {
    if (f instanceof FragmentVNode)
      return f;
    const _this = new FragmentVNode;
    _this._siblings = {};
    _this._keys = [];
    _this._idxByKey = {};
    return _this;
  }
  static _factory(siblings) {
    const _this = FragmentVNode._empty();
    if (siblings == null)
      return _this;
    const keys = Object.keys(siblings);
    if (keys.length < 1)
      return _this;
    let i = 0;
    for (const sid of keys) {
      const vnode = siblings[sid];
      if (isFalsy(vnode))
        continue;
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
    this._df = new DocumentFragment;
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
    this._df = new DocumentFragment;
    this._siblings = {};
    this._keys = [];
    this._idxByKey = {};
  }
  static _delete(f, parent) {
    if (isFalsy(f))
      return;
    f._delete(parent);
  }
  *_reverseWalk() {
    for (let i = this._keys.length - 1;i >= 0; i--) {
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

class TextVNode {
  static _factory(text) {
    if (typeof text !== "string")
      return;
    if (text.length < 1)
      return;
    const _this = new TextVNode;
    _this._text = text || "";
    return _this;
  }
  _is(b) {
    return b instanceof TextVNode;
  }
  _create() {
    this.dom = document.createTextNode(this._text);
    if (DEBUG)
      console.debug(`create ${this.toString()}`, this.dom);
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
    if (DEBUG)
      console.debug(`delete ${this.toString()}`, this.dom);
    parent?.removeChild(this.dom);
  }
  _getNextSibling() {
    return this;
  }
  toString() {
    return `(TextNode ${JSON.stringify(this._text)})`;
  }
}
var attributable = {
  _teardownForeign() {
    const list = this._foreign;
    if (!list)
      return;
    for (const { target, event, fn, opts } of list) {
      target.removeEventListener(event, fn, opts);
    }
    this._foreign = null;
  }
};

class ElementVNode {
  static factory(ns, tag, attrs, children) {
    const _this = new ElementVNode;
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
    if (this.oncreate)
      delayedLifecycleEvents.push(() => this.oncreate(this.dom));
    if (DEBUG)
      console.debug(`create ${this.toString()}`, this.dom);
  }
  _update(parent, old) {
    this.dom = old.dom;
    this._foreign = old._foreign;
    this._cleanup = old._cleanup;
    this._box = old._box;
    if (this._box && this.rebind)
      this.rebind(this._box);
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
    if (DEBUG)
      console.debug(`delete ${this.toString()}`, this.dom);
    parent?.removeChild(this.dom);
  }
  _patchAttr(add, k, v) {
    const ns = NS_BY_PREFIX[k.split(":")[0]];
    if (add) {
      if (ns)
        this.dom.setAttributeNS(ns, k, v);
      else
        this.dom.setAttribute(k, v);
    } else if (ns) {
      this.dom.removeAttributeNS(ns, k.split(":")[1]);
    } else {
      this.dom.removeAttribute(k);
    }
  }
  _getNextSibling() {
    return this;
  }
  toString() {
    return `(Element ns=${this.ns} ${selector(this.dom, this.dom?.nodeName, this.dom?.id, this.dom?.classList?.toString())})`;
  }
}
Object.assign(ElementVNode.prototype, attributable);
var NS_BY_PREFIX = {
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace"
};

class HTMLElementVNode {
  static factory(tag, attrs, children) {
    const _this = new HTMLElementVNode;
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
    if (this.oncreate)
      delayedLifecycleEvents.push(() => this.oncreate(this.dom));
    if (DEBUG)
      console.debug(`create ${this.toString()}`, this.dom);
  }
  _update(parent, old) {
    this.dom = old.dom;
    this._foreign = old._foreign;
    this._cleanup = old._cleanup;
    this._box = old._box;
    if (this._box && this.rebind)
      this.rebind(this._box);
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
    if (DEBUG)
      console.debug(`delete ${this.toString()}`, this.dom);
    parent?.removeChild(this.dom);
  }
  _patchAttr(add, k, v) {
    if (add)
      this.dom.setAttribute(k, v);
    else
      this.dom.removeAttribute(k);
  }
  _getNextSibling() {
    return this;
  }
  toString() {
    return `(HTMLElement ${selector(this.dom, this.dom?.nodeName, this.dom?.id, this.dom?.classList?.toString())})`;
  }
}
Object.assign(HTMLElementVNode.prototype, attributable);

class RawHTMLVNode {
  static factory(tag, attrs, html) {
    const _this = new RawHTMLVNode;
    _this.tag = tag;
    _this.attrs = attrs ?? {};
    _this.html = html ?? "";
    return _this;
  }
  _is(b) {
    return b instanceof RawHTMLVNode && this.tag === b.tag;
  }
  _create() {
    this.dom = document.createElement(this.tag);
    patchAttr(null, this);
    this.dom.innerHTML = this.html;
    if (this.oncreate)
      delayedLifecycleEvents.push(() => this.oncreate(this.dom));
  }
  _update(parent, old) {
    this.dom = old.dom;
    this._foreign = old._foreign;
    this._cleanup = old._cleanup;
    this._box = old._box;
    if (this._box && this.rebind)
      this.rebind(this._box);
    patchAttr(old, this);
    if (this.html !== old.html)
      this.dom.innerHTML = this.html;
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
    if (add)
      this.dom.setAttribute(k, v);
    else
      this.dom.removeAttribute(k);
  }
  _getNextSibling() {
    return this;
  }
  toString() {
    return `(RawHTML ${this.tag})`;
  }
}
Object.assign(RawHTMLVNode.prototype, attributable);

class Component {
  oninit() {}
  onbeforeupdate() {}
  view() {}
  oncreate() {}
  onupdate() {}
  onbeforeremove() {}
  onremove() {}
}

class ComponentVNode {
  static _factory(cls, attrs, children) {
    if (!("view" in (cls?.prototype ?? {}))) {
      throw Error(`component() param cls: expected Component class, ` + `got ${typeof cls} ${JSON.stringify(cls?.constructor?.name)}`);
    }
    const _this = new ComponentVNode;
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
    if (DEBUG)
      console.debug(`create ${this.toString()}`, this);
    const inst = this.instance = new this.cls;
    inst.tag = this.cls?.name;
    inst.state = {};
    inst.attrs = this.attrs ?? {};
    inst.children = FragmentVNode._empty(this._children);
    inst.oninit();
    const children = this._vnode = autoDetect([inst.view()]);
    if (!isFalsy(children))
      children._create();
    delayedLifecycleEvents.push(() => inst.oncreate());
  }
  _update(parent, old) {
    const inst = this.instance = old.instance;
    this._vnode = old._vnode;
    if (inst == null)
      return;
    inst.attrs = this.attrs ?? {};
    inst.children = FragmentVNode._empty(this._children);
    const outcome = inst.onbeforeupdate();
    if (outcome === false)
      return;
    const children = this._vnode = autoDetect([inst.view()]);
    if (!isFalsy(children))
      children._update();
    delayedLifecycleEvents.push(() => inst.onupdate());
  }
  _insert(parent, old, nextSibling) {}
  _recurse(parent, old, nextSibling) {
    updateNodes(parent, old?._vnode, this._vnode, nextSibling);
  }
  _delete(parent) {
    const inst = this.instance;
    if (inst == null)
      return;
    inst.onbeforeremove();
    FragmentVNode._delete(this._vnode, parent);
    if (DEBUG)
      console.debug(`delete ${this.toString()}`, this);
    inst.onremove();
  }
  _getNextSibling() {
    if (isFalsy(this._vnode))
      return;
    return this._vnode._getNextSibling();
  }
  toString() {
    const e = this.instance ?? this;
    return `(Component ${selector(e, e.tag, this.attrs?.id, this.attrs?.class)})`;
  }
}
function volatile(siblings) {
  return FragmentVNode._factory(siblings);
}
function fixed(...children) {
  const siblings = {};
  for (let i = 0, len = children.length;i < len; i++) {
    siblings[`_${i}`] = children[i];
  }
  return FragmentVNode._factory(siblings);
}
var autoDetect = (children) => children.length === 0 ? null : children.length === 1 && children[0] instanceof FragmentVNode ? children[0] : fixed(...children);
var updateNodes = (parent, oldFragment, newFragment, nextSibling) => {
  if (parent == null)
    return;
  const move = [];
  if (!isFalsy(newFragment)) {
    for (const { sid } of newFragment._reverseWalk()) {
      const newSibling = newFragment._siblings[sid];
      const oldSibling = isFalsy(oldFragment) ? null : oldFragment._siblings[sid];
      if (oldSibling == null) {
        if (!("_create" in newSibling.vnode)) {
          console.error("invalid vnode", newSibling.vnode);
        }
        newSibling.vnode?._create(parent);
      } else if (newSibling.vnode._is(oldSibling.vnode)) {
        if (!isFalsy(oldFragment)) {
          move[oldFragment._idxByKey[sid]] = newFragment._idxByKey[sid];
        }
        newSibling.vnode._update(parent, oldSibling.vnode);
      } else {
        oldSibling.vnode?._delete(parent);
        newSibling.vnode?._create(parent);
      }
    }
  }
  if (!isFalsy(oldFragment)) {
    for (const { sid } of oldFragment._reverseWalk()) {
      const oldSibling = oldFragment._siblings[sid];
      if (isFalsy(newFragment) || newFragment._idxByKey[sid] == null) {
        oldSibling.vnode?._delete(parent);
      }
    }
  }
  if (!isFalsy(newFragment)) {
    const skip = longestIncreasingSubsequence(move);
    let lastDom = nextSibling;
    for (const { i, sid, sibling } of newFragment._reverseWalk()) {
      const oldSibling = isFalsy(oldFragment) ? null : oldFragment._siblings[sid];
      const newVNode = sibling.vnode;
      const oldVNode = oldSibling?.vnode;
      const next = lastDom;
      if (skip.has(i) && oldSibling != null) {
        newVNode._recurse(parent, oldVNode, next);
      } else {
        newVNode._insert(parent, oldVNode, next);
        newVNode._recurse(parent, oldVNode, next);
      }
      const v = newVNode._getNextSibling();
      lastDom = v?.dom ?? lastDom;
    }
  }
};
var longestIncreasingSubsequence = (a) => {
  const dp = [];
  let deepest = null;
  let start = 0;
  let end = 0;
  let mid = 0;
  for (let i = 0, l = a.length;i < l; i++) {
    if (a[i] == null || Number.isNaN(a[i]))
      continue;
    if (deepest == null || (deepest.target ?? 0) < (a[i] ?? 0)) {
      deepest = { target: a[i], idx: i, leaf: dp[dp.length - 1] };
      dp.push(deepest);
      continue;
    }
    start = 0;
    end = dp.length - 1;
    while (start < end) {
      mid = (start >>> 1) + (end >>> 1) + (start & end & 1);
      if ((dp[mid].target ?? 0) < (a[i] ?? 0))
        start = mid + 1;
      else
        end = mid;
    }
    dp[start] = { target: a[i], idx: i, leaf: dp[start - 1] };
    if (start === dp.length - 1)
      deepest = dp[start];
  }
  let c = deepest;
  const results = new Set;
  while (c != null) {
    results.add(a[c.idx]);
    c = c.leaf;
  }
  return results;
};
var PROPERTY_ATTRS = new Set([
  "value",
  "checked",
  "selected",
  "indeterminate",
  "muted",
  "volume"
]);
var isPropertyAttr = (dom, k) => PROPERTY_ATTRS.has(k) && (k !== "value" || dom.tagName === "INPUT" || dom.tagName === "TEXTAREA" || dom.tagName === "SELECT" || dom.tagName === "OPTION" || dom.tagName === "PROGRESS");
function normalizeAttrValue(k, v) {
  const type = typeof v;
  if (type === "number" || type === "boolean")
    v = String(v);
  else if (type !== "string")
    v = "";
  if (k === "class")
    v = String(v).trim();
  return v;
}
var patchAttr = (oldVNode, newVNode) => {
  let k, v, ov;
  const apply = () => {
    if (k[0] === "o" && k[1] === "n") {
      applyListener(oldVNode, newVNode, k, v, ov);
      return;
    }
    if (isPropertyAttr(newVNode.dom, k)) {
      const next2 = v == null || v === false ? "" : v === true ? true : v;
      if (k === "checked" || k === "selected" || k === "indeterminate" || k === "muted") {
        const b = !!v && v !== "false";
        if (newVNode.dom[k] !== b)
          newVNode.dom[k] = b;
      } else if (newVNode.dom[k] !== next2) {
        newVNode.dom[k] = next2;
      }
      return;
    }
    const drop = isFalsy(v);
    const next = drop ? "" : normalizeAttrValue(k, v);
    if (isFalsy(oldVNode)) {
      if (drop)
        return;
    } else {
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
  if (isFalsy(oldVNode))
    return;
  for (k in oldVNode.attrs) {
    if (!(k in newVNode.attrs)) {
      v = null;
      ov = oldVNode.attrs[k];
      apply();
    }
  }
};
function applyListener(oldVNode, newVNode, k, v, ov) {
  const event = k.substr(2).split("|")[0];
  if (v == null) {
    if (typeof ov === "function")
      unbind(newVNode, event, ov);
    return;
  }
  if (ov == null) {
    if (typeof v === "function")
      bind(newVNode, event, v);
    return;
  }
  if (typeof ov === "function" && typeof v === "function") {
    if (String(ov) !== String(v) || ov.target !== v.target) {
      unbind(newVNode, event, ov);
      bind(newVNode, event, v);
    } else {
      if (v.rebind)
        v.rebind(ov);
      newVNode.attrs[k] = ov;
      if (newVNode.dom)
        ov.host = newVNode.dom;
    }
  }
}
function targetFor(vnode, fn) {
  if (fn.target === "window")
    return typeof window !== "undefined" ? window : null;
  if (fn.target === "document")
    return typeof document !== "undefined" ? document : null;
  return vnode.dom;
}
function bind(vnode, event, fn) {
  const target = targetFor(vnode, fn);
  if (!target)
    return;
  fn.host = vnode.dom;
  const opts = fn.opts;
  target.addEventListener(event, fn, opts);
  if (fn.target) {
    (vnode._foreign ??= []).push({ target, event, fn, opts });
  }
}
function unbind(vnode, event, fn) {
  const target = targetFor(vnode, fn);
  if (!target)
    return;
  target.removeEventListener(event, fn, fn.opts);
  if (vnode._foreign) {
    vnode._foreign = vnode._foreign.filter((r) => r.fn !== fn);
  }
}

// src/parse.js
var DIR_ORDER = [
  "ignore",
  "ref",
  "data",
  "init",
  "for",
  "if",
  "model",
  "bind",
  "text",
  "html",
  "show",
  "transition",
  "on",
  "effect",
  "cloak",
  "mount"
];
function isDir(name) {
  return name.startsWith("x-") || name.startsWith("m-") || name.startsWith("@") || name.startsWith(":") && name.length > 1 && !name.startsWith("::");
}
function parseDirective(attrName) {
  let name = attrName;
  if (name.startsWith("@")) {
    const [, target, event] = name.match(/^@([^.]+)\.(.+)$/) || [];
    if ((target === "window" || target === "document") && event) {
      const [eventName, ...modifiers] = event.split(".");
      return {
        type: "on",
        arg: eventName,
        modifiers: [target, ...modifiers],
        raw: attrName
      };
    }
    return {
      type: "on",
      arg: name.slice(1).split(".")[0],
      modifiers: name.slice(1).split(".").slice(1),
      raw: attrName
    };
  }
  if (name.startsWith(":") && !name.startsWith("::")) {
    return {
      type: "bind",
      arg: name.slice(1).split(".")[0],
      modifiers: name.slice(1).split(".").slice(1),
      raw: attrName
    };
  }
  if (name.startsWith("x-") || name.startsWith("m-"))
    name = name.slice(2);
  const [head, ...rest] = name.split(":");
  const type = head.split(".")[0];
  const typeMods = head.split(".").slice(1);
  const argPart = rest.join(":");
  const arg = argPart ? argPart.split(".")[0] : null;
  const argMods = argPart ? argPart.split(".").slice(1) : [];
  return { type, arg, modifiers: [...typeMods, ...argMods], raw: attrName };
}
function dirPriority(type) {
  const i = DIR_ORDER.indexOf(type);
  return i === -1 ? 100 : i;
}
var INLINE = new Set([
  "A",
  "ABBR",
  "B",
  "BDI",
  "BDO",
  "BR",
  "BUTTON",
  "CITE",
  "CODE",
  "DATA",
  "DEL",
  "DFN",
  "EM",
  "I",
  "IMG",
  "INPUT",
  "INS",
  "KBD",
  "LABEL",
  "MARK",
  "Q",
  "RUBY",
  "S",
  "SAMP",
  "SELECT",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TEXTAREA",
  "TIME",
  "U",
  "VAR",
  "WBR"
]);
var PRESERVE_WS = new Set(["PRE", "TEXTAREA"]);
var isWhitespaceOnly = (s) => !/[^\t\n\f\r ]/.test(s);
var NS_BY_TAG = { svg: SVG_NS, math: MATHML_NS };
var cache = new Map;
function parseTemplate(html) {
  const key = html ?? "";
  let ast = cache.get(key);
  if (ast)
    return ast;
  ast = parseFragment(key);
  cache.set(key, ast);
  return ast;
}
function parseFragment(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html ?? "";
  return walkChildren(tpl.content, HTML_NS, false);
}
function parseElement(el) {
  return walkNode(el, el.namespaceURI || HTML_NS, false);
}
function childNodesOf(node) {
  if (node.tagName === "TEMPLATE" && node.content)
    return node.content.childNodes;
  return node.childNodes;
}
function walkChildren(parent, ns, preserveWs) {
  const out = [];
  const nodes = [...childNodesOf(parent)];
  for (let i = 0;i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType === 3) {
      const text = node.data;
      if (preserveWs) {
        out.push({ kind: "text", text });
        continue;
      }
      if (isWhitespaceOnly(text)) {
        const prev = nodes[i - 1];
        const next = nodes[i + 1];
        const between = prev?.nodeType === 1 && next?.nodeType === 1 && INLINE.has(prev.tagName) && INLINE.has(next.tagName);
        if (between)
          out.push({ kind: "text", text: " " });
        continue;
      }
      out.push({ kind: "text", text });
      continue;
    }
    if (node.nodeType !== 1)
      continue;
    const child = walkNode(node, ns, preserveWs);
    if (child)
      out.push(child);
  }
  return out;
}
function walkNode(el, parentNs, parentPreserveWs) {
  const tagName = el.tagName;
  if (tagName === "SCRIPT")
    return null;
  const lower = tagName.toLowerCase();
  const ns = el.namespaceURI || NS_BY_TAG[lower] || parentNs;
  const attrs = {};
  const dirs = [];
  for (const attr of [...el.attributes]) {
    if (isDir(attr.name)) {
      dirs.push({ ...parseDirective(attr.name), expression: attr.value });
    } else {
      attrs[attr.name] = attr.value;
    }
  }
  dirs.sort((a, b) => dirPriority(a.type) - dirPriority(b.type));
  const node = {
    kind: "el",
    ns,
    tag: lower,
    isTemplate: tagName === "TEMPLATE",
    attrs,
    dirs,
    children: []
  };
  for (const d of dirs) {
    switch (d.type) {
      case "ignore":
        node.ignore = true;
        break;
      case "ref":
        node.ref = d.expression;
        break;
      case "data":
        node.data = d;
        break;
      case "init":
        node.init = d;
        break;
      case "for":
        node.for = parseForExpression(d.expression);
        break;
      case "if":
        node.if = d;
        break;
      case "text":
        node.text = d;
        break;
      case "html":
        node.html = d;
        break;
      case "show":
        node.show = d;
        break;
      case "transition":
        node.transition = d;
        break;
      case "model":
        node.model = d;
        break;
      case "mount":
        node.mount = d;
        break;
      case "cloak":
        node.cloak = true;
        break;
      case "effect":
        (node.effects ??= []).push(d);
        break;
      case "on":
        (node.on ??= []).push(d);
        break;
      case "bind":
        if (d.arg === "key")
          node.key = d;
        else
          (node.binds ??= []).push(d);
        break;
    }
  }
  if (node.ignore) {
    node.raw = el.innerHTML;
    return node;
  }
  const preserveWs = parentPreserveWs || PRESERVE_WS.has(tagName);
  node.children = walkChildren(el, ns, preserveWs);
  return node;
}
function parseForExpression(expression) {
  const match = String(expression).match(/^\s*\(?\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*))?\s*\)?\s+(?:in|of)\s+(.+)$/);
  if (!match) {
    console.warn("[m] bad x-for", expression);
    return null;
  }
  const [, item, index, list] = match;
  return { item, index, list, raw: expression };
}

// src/reactive.js
var REACTIVE = Symbol("m.reactive");
var RAW = Symbol("m.raw");
var ITERATE_KEY = Symbol("m.iterate");
var proxyMap = new WeakMap;
var boundMethodCache = new WeakMap;
var activeEffect = null;
var deps = new WeakMap;
var queued = new Set;
var pending = false;
var runsThisFlush = 0;
var MAX_EFFECT_RUNS_PER_FLUSH = 1e4;
var invalidationListeners = new Set;
function onInvalidate(fn) {
  invalidationListeners.add(fn);
  return () => invalidationListeners.delete(fn);
}
var afterRenderQueue = [];
var afterRenderScheduled = false;
function afterRender(fn) {
  afterRenderQueue.push(fn);
  if (afterRenderScheduled)
    return;
  afterRenderScheduled = true;
  scheduleFrame(() => {
    afterRenderScheduled = false;
    drainAfterRender();
  });
}
function drainAfterRender() {
  if (afterRenderQueue.length === 0)
    return;
  const list = afterRenderQueue.splice(0, afterRenderQueue.length);
  for (const fn of list) {
    try {
      fn();
    } catch (e) {
      console.error("[m] $nextTick", e);
    }
  }
}
var flushCount = 0;
var effectCount = 0;
var redrawCount = 0;
function bumpRedrawCount() {
  redrawCount++;
  flushCount++;
}
function scheduleFrame(cb) {
  const raf = typeof requestAnimationFrame === "function" && requestAnimationFrame || typeof globalThis !== "undefined" && typeof globalThis.requestAnimationFrame === "function" && globalThis.requestAnimationFrame || null;
  if (raf)
    return raf.call(globalThis, cb);
  return queueMicrotask(cb);
}
function takePerfStats() {
  const s = { flushes: flushCount, effects: effectCount, redraws: redrawCount };
  flushCount = 0;
  effectCount = 0;
  redrawCount = 0;
  return s;
}
function takeDrawCalls() {
  return takePerfStats().flushes;
}
function track(target, key) {
  if (!activeEffect)
    return;
  let byKey = deps.get(target);
  if (!byKey) {
    byKey = new Map;
    deps.set(target, byKey);
  }
  let set = byKey.get(key);
  if (!set) {
    set = new Set;
    byKey.set(key, set);
  }
  set.add(activeEffect);
  activeEffect._deps?.add(set);
}
function trigger(target, key) {
  for (const fn of invalidationListeners)
    fn();
  const byKey = deps.get(target);
  if (!byKey)
    return;
  const effects = new Set;
  const exact = byKey.get(key);
  if (exact)
    for (const e of exact)
      effects.add(e);
  if (key === "length") {
    const iter = byKey.get(ITERATE_KEY);
    if (iter)
      for (const e of iter)
        effects.add(e);
  }
  for (const e of effects)
    scheduleEffect(e);
}
function scheduleEffect(e) {
  queued.add(e);
  if (pending)
    return;
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
  if (queued.size === 0)
    return;
  flushCount++;
  while (queued.size > 0) {
    const list = [...queued];
    queued.clear();
    for (const e of list) {
      if (++runsThisFlush > MAX_EFFECT_RUNS_PER_FLUSH) {
        console.error("[m] effect run cap hit — possible infinite loop; stopping flush");
        queued.clear();
        return;
      }
      try {
        effectCount++;
        e();
      } catch (err) {
        console.error("[m] effect error", err);
      }
    }
  }
}
function flushSync() {
  if (queued.size === 0 && !pending)
    return;
  pending = false;
  runsThisFlush = 0;
  flushEffects();
  if (queued.size > 0 && !pending) {
    pending = true;
    scheduleFrame(runScheduledFlush);
  }
}
function canReactive(v) {
  if (v == null || typeof v !== "object")
    return false;
  if (v[REACTIVE])
    return true;
  if (proxyMap.has(v))
    return true;
  if (Array.isArray(v))
    return true;
  if (v instanceof Date || v instanceof RegExp || v instanceof Promise) {
    return false;
  }
  if (typeof Node !== "undefined" && v instanceof Node)
    return false;
  const tag = Object.prototype.toString.call(v);
  return tag === "[object Object]";
}
function reactive(target) {
  if (target == null || typeof target !== "object")
    return target;
  if (target[REACTIVE])
    return target;
  const existing = proxyMap.get(target);
  if (existing)
    return existing;
  if (!canReactive(target))
    return target;
  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === REACTIVE)
        return true;
      if (key === RAW)
        return obj;
      track(obj, key);
      const val = Reflect.get(obj, key, receiver);
      if (typeof val === "function" && Object.prototype.hasOwnProperty.call(obj, key)) {
        let cache2 = boundMethodCache.get(obj);
        if (!cache2) {
          cache2 = new Map;
          boundMethodCache.set(obj, cache2);
        }
        if (!cache2.has(key))
          cache2.set(key, val.bind(proxy));
        return cache2.get(key);
      }
      if (canReactive(val))
        return reactive(val);
      return val;
    },
    set(obj, key, value) {
      const prev = obj[key];
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const prevLen = Array.isArray(obj) ? obj.length : null;
      const next = canReactive(value) && !value[REACTIVE] ? reactive(value) : value;
      const rawNext = next && typeof next === "object" && next[RAW] ? next[RAW] : next;
      const ok = Reflect.set(obj, key, rawNext, obj);
      if (typeof value === "function" || typeof prev === "function") {
        boundMethodCache.get(obj)?.delete(key);
      }
      if (!Object.is(prev, rawNext))
        trigger(obj, key);
      if (!had && !Array.isArray(obj))
        trigger(obj, ITERATE_KEY);
      if (Array.isArray(obj) && prevLen !== null && obj.length !== prevLen) {
        trigger(obj, "length");
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
      track(obj, Array.isArray(obj) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(obj);
    }
  });
  proxyMap.set(target, proxy);
  return proxy;
}
function effect(fn) {
  const depSets = new Set;
  let stopped = false;
  const runner = () => {
    if (stopped)
      return;
    for (const s of depSets)
      s.delete(runner);
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
    for (const s of depSets)
      s.delete(runner);
    depSets.clear();
  };
}
function findReactiveRoot(scope) {
  let cur = scope;
  let best = null;
  const seen = new Set;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    if (cur[REACTIVE]) {
      best = cur;
    } else {
      const proxied = proxyMap.get(cur);
      if (proxied)
        best = proxied;
    }
    const raw = cur[RAW] || cur;
    cur = Object.getPrototypeOf(raw);
  }
  return best || scope;
}

// src/scope.js
var dataRegistry = new Map;
var STORE_HMR = "__M_ALPINE_STORES__";
var localStoreBucket = new Map;
function storeBucket() {
  if (typeof window === "undefined")
    return localStoreBucket;
  if (!window[STORE_HMR])
    window[STORE_HMR] = new Map;
  return window[STORE_HMR];
}
var storesRoot = null;
function getStoresRoot() {
  if (!storesRoot) {
    const raw = {};
    for (const [k, v] of storeBucket())
      raw[k] = v;
    storesRoot = reactive(raw);
  }
  return storesRoot;
}
var exprCache = new Map;
var actionCache = new Map;
function compile(cache2, expr, body) {
  let fn = cache2.get(expr);
  if (fn !== undefined)
    return fn;
  try {
    fn = new Function("$scope", "$magics", body);
  } catch (_) {
    fn = null;
  }
  cache2.set(expr, fn);
  return fn;
}
function buildMagics(scope, ctx = {}) {
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
      el?.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
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
        afterRender(() => {
          fn?.();
          resolve();
        });
      });
    }
  };
}
var DEBUG2 = false;
function setDebug2(on) {
  DEBUG2 = !!on;
}
function evaluate(expr, scope, ctx, $event) {
  if (expr == null || expr === "")
    return;
  const fn = compile(exprCache, expr, `with ($magics) { with ($scope) { return (${expr}); } }`);
  if (!fn)
    return;
  try {
    const magics = buildMagics(scope, ctx);
    if ($event !== undefined)
      magics.$event = $event;
    return fn(scope ?? {}, magics);
  } catch (err) {
    if (DEBUG2)
      console.warn("[m] eval:", expr, err);
    return;
  }
}
function evaluateAction(expr, scope, ctx, $event) {
  if (!expr)
    return;
  const fn = compile(actionCache, expr, `with ($magics) { with ($scope) { ${expr} } }`);
  if (!fn)
    return evaluate(expr, scope, ctx, $event);
  try {
    const magics = buildMagics(scope, ctx);
    if ($event !== undefined)
      magics.$event = $event;
    return fn(scope ?? {}, magics);
  } catch (err) {
    if (DEBUG2)
      console.warn("[m] action:", expr, err);
    return;
  }
}
function assignPath(scope, path, value) {
  const trimmed = String(path).trim();
  if (trimmed.startsWith("$store.")) {
    const parts2 = trimmed.slice(7).split(".");
    let obj2 = getStoresRoot();
    for (let i = 0;i < parts2.length - 1; i++) {
      obj2 = obj2[parts2[i]];
      if (obj2 == null)
        return;
    }
    obj2[parts2[parts2.length - 1]] = value;
    return;
  }
  const parts = trimmed.split(".");
  let obj = scope;
  for (let i = 0;i < parts.length - 1; i++) {
    obj = obj[parts[i]];
    if (obj == null)
      return;
  }
  obj[parts[parts.length - 1]] = value;
}
function createDataScope(expression, parentScope, ctx) {
  let data;
  const expr = (expression ?? "").trim() === "" ? "{}" : expression.trim();
  const named = expr.match(/^([A-Za-z_$][\w$]*)(\s*\(.*\))?$/);
  if (named && dataRegistry.has(named[1])) {
    const factory = dataRegistry.get(named[1]);
    if (named[2]) {
      const inner = named[2].trim().slice(1, -1);
      const args = inner ? evaluate(`[${inner}]`, parentScope || {}, ctx) || [] : [];
      data = factory(...args);
    } else {
      data = factory();
    }
  } else {
    data = evaluate(expr, parentScope || {}, ctx);
  }
  if (data == null || data === true)
    data = {};
  if (typeof data !== "object")
    data = { value: data };
  if (parentScope) {
    const parentRaw = parentScope[RAW] || parentScope;
    if (data !== parentRaw && Object.getPrototypeOf(data) !== parentRaw) {
      Object.setPrototypeOf(data, parentRaw);
    }
  }
  return reactive(data);
}
function stringify(v) {
  if (v == null || v === false)
    return "";
  return String(v);
}

// src/build.js
var BOOLEAN_ATTRS = new Set([
  "disabled",
  "readonly",
  "required",
  "hidden",
  "multiple",
  "open",
  "autofocus",
  "autoplay",
  "controls",
  "default",
  "defer",
  "ismap",
  "loop",
  "novalidate",
  "reversed",
  "async",
  "inert"
]);
var PROPERTY_ATTRS2 = new Set(["value", "checked", "selected", "indeterminate"]);
function splitClassTokens(s) {
  return String(s || "").split(/\s+/).filter(Boolean);
}
function classToString(value) {
  if (value == null || value === false)
    return "";
  if (typeof value === "string")
    return value;
  if (Array.isArray(value))
    return value.map(classToString).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.entries(value).filter(([, on]) => !!on).map(([k]) => k).join(" ");
  }
  return String(value);
}
function styleToString(value) {
  if (value == null || value === false)
    return "";
  if (typeof value === "string")
    return value;
  if (typeof value !== "object")
    return String(value);
  return Object.entries(value).filter(([, v]) => v != null && v !== false && v !== "").map(([k, v]) => `${kebab(k)}:${v}`).join(";");
}
function kebab(k) {
  return k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
function mergeClass(attrs, extra) {
  const add = splitClassTokens(classToString(extra));
  if (!add.length)
    return;
  const have = splitClassTokens(attrs.class);
  const seen = new Set(have);
  for (const t of add)
    if (!seen.has(t)) {
      have.push(t);
      seen.add(t);
    }
  attrs.class = have.join(" ");
}
function mergeStyle(attrs, extra) {
  const add = styleToString(extra);
  if (!add)
    return;
  const base = String(attrs.style || "").trim().replace(/;$/, "");
  attrs.style = base ? `${base};${add}` : add;
}
function applyBind(attrs, prop, value) {
  if (prop === "class" || prop === "className")
    return mergeClass(attrs, value);
  if (prop === "style")
    return mergeStyle(attrs, value);
  if (PROPERTY_ATTRS2.has(prop)) {
    attrs[prop] = value;
    return;
  }
  if (BOOLEAN_ATTRS.has(prop)) {
    if (value)
      attrs[prop] = prop;
    else
      delete attrs[prop];
    return;
  }
  if (value == null || value === false) {
    delete attrs[prop];
    return;
  }
  if (value === true) {
    attrs[prop] = prop;
    return;
  }
  attrs[prop] = String(value);
}
var EVENT_KEY_ALIASES = {
  enter: "Enter",
  escape: "Escape",
  space: " ",
  tab: "Tab",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  delete: ["Backspace", "Delete"]
};
function matchesEventModifiers(el, event, modifiers) {
  if (modifiers.includes("self") && event.target !== el)
    return false;
  for (const modifier of ["ctrl", "shift", "alt", "meta"]) {
    if (modifiers.includes(modifier) && !event[`${modifier}Key`])
      return false;
  }
  const wantedKeys = modifiers.filter((modifier) => Object.hasOwn(EVENT_KEY_ALIASES, modifier)).flatMap((modifier) => EVENT_KEY_ALIASES[modifier]);
  return wantedKeys.length === 0 || wantedKeys.includes(event.key);
}
function makeHandler(dir, scope, ctx) {
  const { arg, modifiers, expression } = dir;
  const outside = modifiers.includes("outside");
  const handler = function(e) {
    const s = handler.$scope;
    const c = handler.$ctx;
    const el = handler.host ?? e.currentTarget;
    if (outside) {
      if (!el || el.contains(e.target))
        return;
    } else {
      if (el && !matchesEventModifiers(el, e, modifiers))
        return;
    }
    if (modifiers.includes("prevent"))
      e.preventDefault();
    if (modifiers.includes("stop"))
      e.stopPropagation();
    const local = { ...c, getEl: () => el };
    const expr = String(handler.$expr).trim();
    const bare = expr.match(/^[A-Za-z_$][\w$.]*$/);
    if (bare) {
      const fn = evaluate(expr, s, local);
      if (typeof fn === "function") {
        fn.call(findReactiveRoot(s), e);
        return;
      }
    }
    evaluateAction(expr, s, local, e);
  };
  handler.$scope = scope;
  handler.$ctx = ctx;
  handler.$expr = expression;
  const key = `m:on:${arg}:${modifiers.join(".")}:${expression}`;
  handler.toString = () => key;
  handler.rebind = (live) => {
    live.$scope = handler.$scope;
    live.$ctx = handler.$ctx;
    live.$expr = handler.$expr;
  };
  if (modifiers.includes("window"))
    handler.target = "window";
  else if (modifiers.includes("document") || outside)
    handler.target = "document";
  if (modifiers.includes("once"))
    handler.opts = { once: true };
  if (modifiers.includes("passive")) {
    handler.opts = { ...handler.opts || {}, passive: true };
  }
  if (modifiers.includes("capture")) {
    handler.opts = { ...handler.opts || {}, capture: true };
  }
  return handler;
}
function eventAttrName(dir) {
  const outside = dir.modifiers.includes("outside");
  const event = outside ? "click" : dir.arg || "click";
  const mods = dir.modifiers.join(".");
  return mods ? `on${event}|${mods}` : `on${event}`;
}
function applyModel(attrs, ast, dir, scope, ctx) {
  const type = ast.attrs.type;
  const isCheckbox = ast.tag === "input" && (type === "checkbox" || type === "radio");
  const value = evaluate(dir.expression, scope, ctx);
  if (isCheckbox)
    attrs.checked = !!value;
  else
    attrs.value = stringify(value);
  const eventName = dir.modifiers.includes("lazy") || ast.tag === "select" ? "change" : "input";
  const handler = function(e) {
    const t = e.target;
    let next;
    if (t.type === "checkbox")
      next = t.checked;
    else if (t.type === "number")
      next = t.value === "" ? null : Number(t.value);
    else
      next = t.value;
    if (dir.modifiers.includes("number"))
      next = parseFloat(next);
    if (dir.modifiers.includes("trim") && typeof next === "string") {
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
function applyShow(attrs, ast, scope, ctx) {
  const show = !!evaluate(ast.show.expression, scope, ctx);
  if (!ast.transition) {
    if (!show)
      mergeStyle(attrs, "display:none");
    return;
  }
  const ms = transitionMs(ast.transition);
  if (show) {
    mergeStyle(attrs, `opacity:1;visibility:visible;transition:opacity ${ms}ms ease`);
  } else {
    mergeStyle(attrs, `opacity:0;visibility:hidden;transition:opacity ${ms}ms ease,visibility 0s ${ms}ms`);
  }
}
function transitionMs(dir) {
  const dur = dir.modifiers.find((m) => /^duration$/.test(m));
  if (dur) {
    const i = dir.modifiers.indexOf(dur);
    const n = parseInt(dir.modifiers[i + 1], 10);
    if (Number.isFinite(n))
      return n;
  }
  return 150;
}
function buildTemplate(html, scope, ctx) {
  return buildFragment(parseTemplate(html), scope, ctx);
}
function buildFragment(astList, scope, ctx) {
  const siblings = {};
  for (let i = 0;i < astList.length; i++) {
    const v = buildNode(astList[i], scope, ctx);
    if (v != null && v !== false)
      siblings[`_${i}`] = v;
  }
  return volatile(siblings);
}
function buildNode(ast, scope, ctx) {
  if (ast.kind === "text")
    return TextVNode._factory(ast.text);
  if (ast.for)
    return buildFor(ast, scope, ctx);
  if (ast.if && !evaluate(ast.if.expression, scope, ctx))
    return null;
  if (ast.isTemplate)
    return buildFragment(ast.children, scope, ctx);
  if (ast.data)
    return buildDataComponent(ast, scope, ctx);
  if (ast.mount)
    return buildMount(ast, scope, ctx);
  return buildElement(ast, scope, ctx);
}
var objectKeyIds = new WeakMap;
var objectKeySeq = 0;
function keyToSid(key) {
  if (key !== null && (typeof key === "object" || typeof key === "function")) {
    let id = objectKeyIds.get(key);
    if (id === undefined)
      objectKeyIds.set(key, id = `o${++objectKeySeq}`);
    return `k:${id}`;
  }
  return `k:${typeof key}:${String(key)}`;
}
function buildFor(ast, scope, ctx) {
  const spec = ast.for;
  if (!spec)
    return null;
  const list = evaluate(spec.list, scope, ctx);
  const rows = normalizeList(list);
  const parent = scope ?? {};
  const siblings = {};
  const seen = new Map;
  rows.forEach(([item, index], i) => {
    const locals = { [spec.item]: item, $index: i };
    if (spec.index)
      locals[spec.index] = index;
    const rowScope = makeRowScope(parent, locals);
    const key = ast.key ? evaluate(ast.key.expression, rowScope, ctx) : index;
    const base = keyToSid(key);
    const dup = seen.get(base) || 0;
    seen.set(base, dup + 1);
    let sid = base;
    if (dup > 0) {
      console.warn("[m] duplicate x-for key", key, spec.raw);
      sid = `${base}#${dup}`;
    }
    const body = ast.isTemplate ? buildFragment(ast.children, rowScope, ctx) : buildElement(ast, rowScope, ctx);
    siblings[sid] = body;
  });
  return volatile(siblings);
}
function makeRowScope(parent, locals) {
  return new Proxy(locals, {
    has(t, k) {
      return k in t || parent != null && k in parent;
    },
    get(t, k) {
      if (Object.prototype.hasOwnProperty.call(t, k))
        return t[k];
      return parent?.[k];
    },
    set(t, k, v) {
      if (Object.prototype.hasOwnProperty.call(t, k) || parent == null) {
        t[k] = v;
        return true;
      }
      parent[k] = v;
      return true;
    }
  });
}
function normalizeList(list) {
  if (list == null)
    return [];
  if (Array.isArray(list))
    return list.map((v, i) => [v, i]);
  if (typeof list === "number") {
    return Array.from({ length: list }, (_, i) => [i + 1, i]);
  }
  if (typeof list[Symbol.iterator] === "function") {
    return [...list].map((v, i) => [v, i]);
  }
  if (typeof list === "object") {
    return Object.entries(list).map(([k, v]) => [v, k]);
  }
  return [];
}
function componentClassFor(ast) {
  if (ast._cls)
    return ast._cls;

  class DataComponent extends Component {
    oninit() {
      this.refs = {};
      this.ctx = { refs: this.refs, getEl: () => this.rootDom };
      this.scope = createDataScope(ast.data.expression, this.attrs.parentScope, this.ctx);
      if (typeof this.scope.init === "function") {
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
      if (typeof this.scope?.destroy === "function") {
        try {
          this.scope.destroy();
        } catch (_) {}
      }
    }
  }
  Object.defineProperty(DataComponent, "name", { value: `x-data(${ast.tag})` });
  ast._cls = DataComponent;
  return DataComponent;
}
function buildDataComponent(ast, scope, ctx) {
  return ComponentVNode._factory(componentClassFor(ast), { parentScope: scope });
}
var mountClasses = new WeakMap;
function mountClassFor(config) {
  let cls = mountClasses.get(config);
  if (cls)
    return cls;
  cls = class MountComponent extends Component {
    oninit() {
      this.refs = {};
      this.ctx = { refs: this.refs, getEl: () => null };
      if (typeof this.attrs.config.init === "function") {
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
      return buildTemplate(cfg.template || "", cfg, this.ctx);
    }
    onremove() {
      const cfg = this.attrs.config;
      if (typeof cfg?.destroy === "function") {
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
  if (!config || typeof config !== "object")
    return null;
  const host = buildElement({ ...ast, mount: null, children: [] }, scope, ctx);
  if (!host)
    return null;
  host.children = autoDetect([
    ComponentVNode._factory(mountClassFor(config[RAW] || config), { config })
  ]);
  return host;
}
function buildElement(ast, scope, ctx) {
  if (ast.ignore) {
    const v = RawHTMLVNode.factory(ast.tag, { ...ast.attrs }, ast.raw || "");
    return v;
  }
  const attrs = { ...ast.attrs };
  if (ast.cloak)
    delete attrs["x-cloak"];
  if (ast.binds) {
    for (const b of ast.binds) {
      applyBind(attrs, b.arg || "value", evaluate(b.expression, scope, ctx));
    }
  }
  if (ast.show)
    applyShow(attrs, ast, scope, ctx);
  if (ast.model)
    applyModel(attrs, ast, ast.model, scope, ctx);
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
    vnode = ast.ns === HTML_NS ? HTMLElementVNode.factory(ast.tag, attrs, children) : ElementVNode.factory(ast.ns, ast.tag, attrs, children);
  }
  attachLifecycle(vnode, ast, scope, ctx);
  return vnode;
}
function attachLifecycle(vnode, ast, scope, ctx) {
  const needsBox = !!(ast.effects || ast.init);
  if (!ast.ref && !needsBox)
    return;
  if (needsBox) {
    vnode.rebind = (box) => {
      box.scope = scope;
      box.ctx = ctx;
    };
  }
  const prev = vnode.oncreate;
  vnode.oncreate = (dom) => {
    prev?.(dom);
    if (ast.ref)
      ctx.refs[ast.ref] = dom;
    if (!needsBox)
      return;
    const box = { scope, ctx: { ...ctx, getEl: () => dom } };
    vnode._box = box;
    const stops = [];
    if (ast.init) {
      queueMicrotask(() => evaluateAction(ast.init.expression, box.scope, {
        ...box.ctx,
        getEl: () => dom
      }));
    }
    if (ast.effects) {
      for (const e of ast.effects) {
        stops.push(effect(() => evaluateAction(e.expression, box.scope, {
          ...box.ctx,
          getEl: () => dom
        })));
      }
    }
    vnode._cleanup = () => {
      for (const s of stops)
        s();
    };
  };
}

// src/m.js
var VERSION = "3.2.2";
var rootEl = null;
var rootFactory = null;
var rootInstance = null;
var rootCtx = null;
var oldRoot = null;
var renderCount = 0;
var refreshRequestCount = 0;
var alreadyRedrawing = false;
var deferredBatchRedraw = false;
var deferredQueued = false;
var mounts = new Set;
function instantiate(configOrFactory, attrs = {}) {
  let config = typeof configOrFactory === "function" ? configOrFactory(attrs) : configOrFactory;
  if (config == null || typeof config !== "object") {
    config = { template: String(config ?? "") };
  }
  if (typeof config === "function")
    config = config(attrs);
  if (!config.template)
    config.template = "";
  config.$attrs = attrs;
  return reactive(config);
}
function renderRoot() {
  if (!rootInstance)
    return null;
  return buildTemplate(rootInstance.template || "", rootInstance, rootCtx);
}
function drainLifecycle() {
  const hooks = delayedLifecycleEvents.splice(0, delayedLifecycleEvents.length);
  for (const hook of hooks) {
    try {
      hook();
    } catch (e) {
      console.error("[m] lifecycle", e);
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
  drainAfterRender();
}
var instanceCache = new Map;
function clearInstances() {
  for (const inst of instanceCache.values()) {
    if (typeof inst.destroy === "function") {
      try {
        inst.destroy();
      } catch (_) {}
    }
  }
  instanceCache.clear();
}
function initTree(el, scope) {
  const root = el === document ? document.body : el;
  if (!root)
    return root;
  if (root === document.body || root.tagName === "BODY") {
    const out = [];
    for (const child of [...root.children])
      out.push(initTree(child, scope));
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
    old: null
  };
  if (!mount.parent)
    return root;
  root.remove();
  const next = buildFragment(ast, mount.scope, ctx);
  updateNodes(mount.parent, null, next, mount.nextSibling);
  mount.old = next;
  mounts.add(mount);
  drainLifecycle();
  const first = next._siblings[next._keys[0]]?.vnode;
  const dom = first?._getNextSibling()?.dom ?? null;
  if (dom)
    mount.el = dom;
  return dom ?? root;
}
function destroyTree(el) {
  for (const mount of [...mounts]) {
    if (!mount.old)
      continue;
    if (mount.el === el || el && mount.el && el.contains(mount.el)) {
      FragmentVNode._delete(mount.old, mount.parent);
      mounts.delete(mount);
    }
  }
}
var M = {
  version: VERSION,
  set debug(on) {
    setDebug(on);
    setDebug2(on);
  },
  data(name, factory) {
    dataRegistry.set(name, factory);
    return factory;
  },
  store(name, value) {
    const bucket = storeBucket();
    const root = getStoresRoot();
    if (value === undefined)
      return root[name];
    const existing = bucket.get(name);
    if (existing) {
      const incoming = typeof value === "function" ? value() : value;
      for (const k of Object.keys(incoming)) {
        if (typeof incoming[k] === "function")
          existing[k] = incoming[k];
        else if (!(k in existing))
          existing[k] = incoming[k];
      }
      root[name] = existing;
      return existing;
    }
    const data = typeof value === "function" ? value() : value;
    const proxy = reactive(data && typeof data === "object" ? data : { value: data });
    bucket.set(name, proxy);
    root[name] = proxy;
    if (typeof proxy.init === "function")
      queueMicrotask(() => proxy.init());
    return proxy;
  },
  start(root = document) {
    installCloakStyle();
    return initTree(root === document ? document.body : root);
  },
  initTree,
  destroyTree,
  Router,
  createStore,
  mount(el, factory) {
    rootEl = typeof el === "string" ? document.querySelector(el) : el || document.body;
    rootFactory = factory != null ? typeof factory === "function" ? factory : () => factory : () => Router.render();
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
    if (rootEl && oldRoot)
      FragmentVNode._delete(oldRoot, rootEl);
    for (const mount of [...mounts]) {
      if (mount.old)
        FragmentVNode._delete(mount.old, mount.parent);
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
  deferredBatchRedraw() {
    if (alreadyRedrawing) {
      deferredBatchRedraw = true;
      return;
    }
    if (deferredQueued)
      return;
    deferredQueued = true;
    scheduleFrame(() => {
      deferredQueued = false;
      M.redraw();
    });
  },
  invalidate() {
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
  Component,
  ComponentVNode,
  parseTemplate,
  buildTemplate,
  updateNodes
};
function installCloakStyle() {
  if (typeof document === "undefined")
    return;
  if (document.getElementById("m-cloak-style"))
    return;
  const s = document.createElement("style");
  s.id = "m-cloak-style";
  s.textContent = "[x-cloak],[m-cloak]{display:none !important;}";
  document.head.appendChild(s);
}
onInvalidate(() => {
  if (rootEl || mounts.size)
    M.deferredBatchRedraw();
});
var m_default = M;
if (typeof window !== "undefined") {
  window.M = M;
  window.m = M;
}
export {
  takePerfStats,
  takeDrawCalls,
  reactive,
  m_default as m,
  longestIncreasingSubsequence,
  initTree,
  flushSync,
  effect,
  destroyTree,
  m_default as default,
  createStore,
  clearStore,
  Router,
  M
};
