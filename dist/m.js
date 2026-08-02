/*! m.js v3.0.0 | MIT | https://mikesmullin.github.io/m-js/ */

// src/router.js
var RX_ABSOLUTE_URL = /^(?:\w{1,99}:)?\/\//;
var routes = new Map;
var currentUri = "";
var basePath = "";
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

class Router {
  static get uri() {
    return currentUri;
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
    const full = withBase(path);
    if (window.location.pathname !== full) {
      window.history.pushState(null, title || "", full);
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
    Router.syncFromLocation();
  }
  static syncFromLocation() {
    const path = stripBase(window.location.pathname || "/");
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
    if (basePath && (href === basePath || href === basePath + "/" || href.startsWith(basePath + "/"))) {
      appPath = stripBase(href);
    }
    if (e.ctrlKey || e.metaKey) {
      window.open(`${window.location.origin}${withBase(appPath)}`);
    } else {
      Router.set(appPath);
    }
    return false;
  }
  static href(uri) {
    return withBase(uri);
  }
  static start() {
    if (!basePath)
      Router.detectBase();
    window.addEventListener("popstate", Router._popstate, false);
    const path = stripBase(window.location.pathname || "/");
    const matched = Router.match(path);
    currentUri = path;
    params = matched?.params ?? {};
    if (matched) {
      let title = matched.route.title;
      if (typeof formatTitle === "function")
        title = formatTitle(title);
      if (typeof title === "string" && title)
        document.title = title;
      const full = withBase(path);
      if (window.location.pathname !== full) {
        window.history.replaceState(null, title || "", full);
      }
    }
  }
  static stop() {
    window.removeEventListener("popstate", Router._popstate, false);
  }
  static list() {
    return [...routes.keys()];
  }
  static reset() {
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

// src/m.js
var VERSION = "3.0.0";
var DEBUG = false;
var REACTIVE = Symbol("m.reactive");
var RAW = Symbol("m.raw");
var proxyMap = new WeakMap;
var boundMethodCache = new WeakMap;
var activeEffect = null;
var deps = new WeakMap;
function track(target, key) {
  if (!activeEffect)
    return;
  if (key === REACTIVE || key === RAW)
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
  const byKey = deps.get(target);
  if (!byKey)
    return;
  const effects = new Set;
  const exact = byKey.get(key);
  if (exact)
    for (const e of exact)
      effects.add(e);
  if (key === "length") {
    const iter = byKey.get(Symbol.iterator);
    if (iter)
      for (const e of iter)
        effects.add(e);
  }
  for (const e of effects)
    scheduleEffect(e);
}
var queued = new Set;
var pending = false;
var MAX_EFFECT_RUNS_PER_FLUSH = 1000;
var runsThisFlush = 0;
var flushCount = 0;
var effectCount = 0;
var redrawCount = 0;
function scheduleFrame(cb) {
  const raf = typeof requestAnimationFrame === "function" && requestAnimationFrame || typeof globalThis !== "undefined" && typeof globalThis.requestAnimationFrame === "function" && globalThis.requestAnimationFrame || null;
  if (raf)
    return raf.call(globalThis, cb);
  return queueMicrotask(cb);
}
function takePerfStats() {
  const s = {
    flushes: flushCount,
    effects: effectCount,
    redraws: redrawCount
  };
  flushCount = 0;
  effectCount = 0;
  redrawCount = 0;
  return s;
}
function takeDrawCalls() {
  return takePerfStats().flushes;
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
        let cache = boundMethodCache.get(obj);
        if (!cache) {
          cache = new Map;
          boundMethodCache.set(obj, cache);
        }
        if (!cache.has(key))
          cache.set(key, val.bind(proxy));
        return cache.get(key);
      }
      if (canReactive(val))
        return reactive(val);
      return val;
    },
    set(obj, key, value, receiver) {
      const prev = obj[key];
      const prevLen = Array.isArray(obj) ? obj.length : null;
      const next = canReactive(value) && !value[REACTIVE] ? reactive(value) : value;
      const rawNext = next && typeof next === "object" && next[RAW] ? next[RAW] : next;
      const ok = Reflect.set(obj, key, rawNext, obj);
      if (typeof value === "function" || typeof prev === "function") {
        boundMethodCache.get(obj)?.delete(key);
      }
      if (!Object.is(prev, rawNext))
        trigger(obj, key);
      if (Array.isArray(obj) && prevLen !== null && obj.length !== prevLen) {
        trigger(obj, "length");
      }
      return ok;
    },
    deleteProperty(obj, key) {
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const ok = Reflect.deleteProperty(obj, key);
      if (had)
        trigger(obj, key);
      return ok;
    }
  });
  proxyMap.set(target, proxy);
  return proxy;
}
function longestIncreasingSubsequence(a) {
  const dp = [];
  let deepest = null;
  for (let i = 0, l = a.length;i < l; i++) {
    if (a[i] == null || Number.isNaN(a[i]))
      continue;
    if (deepest == null || (deepest.target ?? 0) < (a[i] ?? 0)) {
      deepest = { target: a[i], idx: i, leaf: dp[dp.length - 1] };
      dp.push(deepest);
      continue;
    }
    let start = 0;
    let end = dp.length - 1;
    while (start < end) {
      const mid = (start >>> 1) + (end >>> 1) + (start & end & 1);
      if ((dp[mid].target ?? 0) < (a[i] ?? 0))
        start = mid + 1;
      else
        end = mid;
    }
    dp[start] = { target: a[i], idx: i, leaf: dp[start - 1] };
    if (start === dp.length - 1)
      deepest = dp[start];
  }
  const results = new Set;
  let c = deepest;
  while (c != null) {
    results.add(a[c.idx]);
    c = c.leaf;
  }
  return results;
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
      el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
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
    }
  };
  return magics;
}
function collectRefs(root) {
  const refs = {};
  walk(root, (el) => {
    const name = el.getAttribute?.("x-ref") || el.getAttribute?.("m-ref");
    if (name)
      refs[name] = el;
  });
  return refs;
}
function evaluate(expr, scope, el, $event) {
  if (expr == null || expr === "")
    return;
  try {
    const magics = el ? buildMagics(el, scope) : {};
    if ($event !== undefined)
      magics.$event = $event;
    const fn = new Function("$scope", "$magics", `with ($magics) { with ($scope) { return (${expr}); } }`);
    return fn(scope ?? {}, magics);
  } catch (err) {
    if (DEBUG)
      console.warn("[m] eval:", expr, err);
    return;
  }
}
function evaluateAction(expr, scope, el, $event) {
  if (!expr)
    return;
  try {
    const magics = el ? buildMagics(el, scope) : {};
    if ($event !== undefined)
      magics.$event = $event;
    const fn = new Function("$scope", "$magics", `with ($magics) { with ($scope) { ${expr} } }`);
    fn(scope ?? {}, magics);
  } catch (err) {
    try {
      evaluate(expr, scope, el, $event);
    } catch (err2) {
      if (DEBUG)
        console.warn("[m] action:", expr, err2);
    }
  }
}
function walk(el, cb) {
  if (el.nodeType !== 1)
    return;
  const skip = cb(el);
  if (skip === false)
    return;
  for (const child of [...el.children])
    walk(child, cb);
}
var elementData = new WeakMap;
var elementCleanups = new WeakMap;
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
    if (elementData.has(cur))
      return elementData.get(cur);
    cur = cur.parentElement;
  }
  return null;
}
function closestRoot(el) {
  let cur = el;
  let root = el;
  while (cur) {
    if (elementData.has(cur))
      root = cur;
    if (cur.hasAttribute?.("x-data") || cur.hasAttribute?.("m-data"))
      root = cur;
    cur = cur.parentElement;
  }
  return root;
}
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
  "cloak"
];
function isDir(name) {
  return name.startsWith("x-") || name.startsWith("m-") || name.startsWith("@") || name.startsWith(":") && name.length > 1;
}
function parseDirective(attrName) {
  let name = attrName;
  if (name.startsWith("@")) {
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
  return {
    type,
    arg,
    modifiers: [...typeMods, ...argMods],
    raw: attrName
  };
}
function dirPriority(type) {
  const i = DIR_ORDER.indexOf(type);
  return i === -1 ? 100 : i;
}
var boundClassUndo = new WeakMap;
var boundStyleUndo = new WeakMap;
function splitClassTokens(s) {
  return String(s || "").split(/\s+/).filter(Boolean);
}
function setClassesFromString(el, classString) {
  if (classString === true)
    classString = "";
  const want = splitClassTokens(classString || "");
  const beforeTokens = splitClassTokens(el.getAttribute("class") || el.className || "");
  const beforeSet = new Set(beforeTokens);
  const toAdd = want.filter((t) => !beforeSet.has(t));
  if (toAdd.length) {
    const next = [...beforeTokens, ...toAdd].join(" ");
    el.setAttribute("class", next);
    if (globalThis.__m_debug_class) {
      console.log("[setClassesFromString]", {
        classString,
        beforeTokens,
        toAdd,
        next,
        afterAttr: el.getAttribute("class"),
        afterClassName: el.className
      });
    }
  }
  return () => {
    if (!toAdd.length)
      return;
    const drop = new Set(toAdd);
    const cur = splitClassTokens(el.getAttribute("class") || el.className || "");
    el.setAttribute("class", cur.filter((t) => !drop.has(t)).join(" "));
  };
}
function setClassesFromObject(el, classObject) {
  const forAdd = Object.entries(classObject).flatMap(([classString, on]) => on ? splitClassTokens(classString) : []).filter(Boolean);
  const forRemove = Object.entries(classObject).flatMap(([classString, on]) => !on ? splitClassTokens(classString) : []).filter(Boolean);
  const tokens = splitClassTokens(el.getAttribute("class") || el.className || "");
  const set = new Set(tokens);
  const added = [];
  const removed = [];
  for (const t of forRemove) {
    if (set.has(t)) {
      set.delete(t);
      removed.push(t);
    }
  }
  for (const t of forAdd) {
    if (!set.has(t)) {
      set.add(t);
      added.push(t);
    }
  }
  el.setAttribute("class", [...set].join(" "));
  return () => {
    const cur = new Set(splitClassTokens(el.getAttribute("class") || el.className || ""));
    for (const t of removed)
      cur.add(t);
    for (const t of added)
      cur.delete(t);
    el.setAttribute("class", [...cur].join(" "));
  };
}
function applyClassBinding(el, result) {
  const prev = boundClassUndo.get(el);
  if (prev)
    prev();
  let undo = () => {};
  if (typeof result === "function") {
    applyClassBinding(el, result());
    return;
  }
  if (typeof result === "object" && result && !Array.isArray(result)) {
    undo = setClassesFromObject(el, result);
  } else if (Array.isArray(result)) {
    undo = setClassesFromString(el, result.filter(Boolean).join(" "));
  } else if (result != null && result !== false && result !== "") {
    undo = setClassesFromString(el, String(result));
  }
  boundClassUndo.set(el, undo);
}
function kebabCaseStyle(key) {
  if (key.startsWith("--"))
    return key;
  return String(key).replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
function setStylesFromObject(el, value) {
  const previous = {};
  for (const [rawKey, rawVal] of Object.entries(value || {})) {
    const key = kebabCaseStyle(rawKey);
    previous[key] = el.style.getPropertyValue(key);
    if (rawVal == null || rawVal === false || rawVal === "") {
      el.style.removeProperty(key);
    } else {
      el.style.setProperty(key, String(rawVal));
    }
  }
  return () => {
    for (const [key, prev] of Object.entries(previous)) {
      if (prev)
        el.style.setProperty(key, prev);
      else
        el.style.removeProperty(key);
    }
  };
}
function applyStyleBinding(el, result) {
  const prev = boundStyleUndo.get(el);
  if (prev)
    prev();
  let undo = () => {};
  if (typeof result === "object" && result) {
    undo = setStylesFromObject(el, result);
  } else if (result != null && result !== false) {
    const cache = el.getAttribute("style");
    el.setAttribute("style", String(result));
    undo = () => {
      if (cache == null || cache === "")
        el.removeAttribute("style");
      else
        el.setAttribute("style", cache);
    };
  }
  boundStyleUndo.set(el, undo);
}
function applyBinding(el, prop, result) {
  if (prop === "class" || prop === "className") {
    applyClassBinding(el, result);
  } else if (prop === "style") {
    applyStyleBinding(el, result);
  } else if (prop === "disabled" || prop === "checked" || prop === "readonly" || prop === "required" || prop === "multiple" || prop === "selected") {
    el[prop] = !!result;
    if (!result)
      el.removeAttribute(prop);
    else
      el.setAttribute(prop, "");
  } else if (prop === "value") {
    if (el.tagName === "OPTION") {
      if (el.getAttribute("value") !== String(result ?? "")) {
        el.setAttribute("value", String(result ?? ""));
      }
    } else if (el.value !== String(result ?? "")) {
      el.value = result ?? "";
    }
  } else if (result == null || result === false) {
    el.removeAttribute(prop);
  } else {
    el.setAttribute(prop, result === true ? "" : String(result));
  }
}
function stringify(v) {
  if (v == null || v === false)
    return "";
  return String(v);
}
function processElement(el, parentScope) {
  if (el.hasAttribute("x-ignore") || el.hasAttribute("m-ignore")) {
    return false;
  }
  const dirs = [];
  for (const attr of [...el.attributes]) {
    if (!isDir(attr.name))
      continue;
    const parsed = parseDirective(attr.name);
    dirs.push({ ...parsed, expression: attr.value, attrName: attr.name });
  }
  dirs.sort((a, b) => dirPriority(a.type) - dirPriority(b.type));
  let scope = parentScope || closestData(el) || {};
  let skipChildren = false;
  for (const dir of dirs) {
    const { type, arg, modifiers, expression, attrName } = dir;
    if (type !== "cloak" && type !== "data") {
      if (type !== "ref")
        el.removeAttribute(attrName);
    }
    switch (type) {
      case "ignore":
        return false;
      case "ref":
        break;
      case "data": {
        scope = initData(el, expression, parentScope);
        break;
      }
      case "init": {
        const stop = effect(() => {});
        stop();
        queueMicrotask(() => evaluateAction(expression, scope, el));
        addCleanup(el, () => {});
        break;
      }
      case "for": {
        processFor(el, expression, scope);
        return false;
      }
      case "if": {
        processIf(el, expression, scope);
        return false;
      }
      case "text": {
        const stop = effect(() => {
          el.textContent = stringify(evaluate(expression, scope, el));
        });
        addCleanup(el, stop);
        break;
      }
      case "html": {
        const stop = effect(() => {
          el.innerHTML = stringify(evaluate(expression, scope, el));
        });
        addCleanup(el, stop);
        break;
      }
      case "show": {
        const transition = dirs.some((d) => d.type === "transition");
        const stop = effect(() => {
          const show = !!evaluate(expression, scope, el);
          applyShow(el, show, transition);
        });
        addCleanup(el, stop);
        break;
      }
      case "transition":
        el.removeAttribute(attrName);
        break;
      case "model": {
        processModel(el, expression, scope, modifiers);
        break;
      }
      case "bind": {
        const prop = arg || "value";
        if (prop === "class" || prop === "className") {
          const cur = el.getAttribute("class");
          el.removeAttribute("class");
          if (cur != null && cur !== "")
            el.setAttribute("class", cur);
        }
        const stop = effect(() => {
          applyBinding(el, prop, evaluate(expression, scope, el));
        });
        addCleanup(el, () => {
          stop();
          if (prop === "class" || prop === "className") {
            const u = boundClassUndo.get(el);
            if (u)
              u();
            boundClassUndo.delete(el);
          } else if (prop === "style") {
            const u = boundStyleUndo.get(el);
            if (u)
              u();
            boundStyleUndo.delete(el);
          }
        });
        break;
      }
      case "on": {
        processOn(el, arg || "click", expression, scope, modifiers);
        break;
      }
      case "effect": {
        const stop = effect(() => {
          evaluateAction(expression, scope, el);
        });
        addCleanup(el, stop);
        break;
      }
      case "cloak":
        el.removeAttribute(attrName);
        el.removeAttribute("x-cloak");
        el.removeAttribute("m-cloak");
        break;
      case "mount": {
        let mounted = null;
        const stop = effect(() => {
          const child = evaluate(expression, scope, el);
          if (!child)
            return;
          if (mounted !== child) {
            mounted = child;
            mountComponent(el, child);
          }
        });
        addCleanup(el, stop);
        break;
      }
      default:
        if (DEBUG)
          console.warn("[m] unknown directive", type);
    }
  }
  return !skipChildren;
}
function initData(el, expression, parentScope) {
  let data;
  const expr = expression.trim() === "" ? "{}" : expression.trim();
  const named = expr.match(/^([A-Za-z_$][\w$]*)(\s*\(.*\))?$/);
  if (named && dataRegistry.has(named[1])) {
    const factory = dataRegistry.get(named[1]);
    if (named[2]) {
      const args = evaluate(`([...${named[2]}])`, parentScope || {}, el) || [];
      data = factory(...args);
    } else {
      data = factory();
    }
  } else {
    data = evaluate(expr, parentScope || {}, el);
  }
  if (data == null || data === true)
    data = {};
  if (typeof data !== "object")
    data = { value: data };
  if (parentScope) {
    const parentRaw = parentScope[RAW] || parentScope;
    Object.setPrototypeOf(data, parentRaw);
  }
  const proxy = reactive(data);
  elementData.set(el, proxy);
  if (typeof proxy.init === "function") {
    queueMicrotask(() => {
      try {
        proxy.init();
      } catch (e) {
        console.error(e);
      }
    });
  }
  addCleanup(el, () => {
    if (typeof proxy.destroy === "function") {
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
      el.style.display = "";
      el.style.opacity = "0";
      el.offsetHeight;
      el.style.transition = "opacity 150ms ease";
      el.style.opacity = "1";
    } else {
      el.style.transition = "opacity 150ms ease";
      el.style.opacity = "0";
      const done = () => {
        if (el.style.opacity === "0")
          el.style.display = "none";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
      setTimeout(done, 160);
    }
  } else {
    el.style.display = show ? "" : "none";
  }
}
function processModel(el, expression, scope, modifiers) {
  const tag = el.tagName;
  const type = el.getAttribute("type");
  const stop = effect(() => {
    const val = evaluate(expression, scope, el);
    if (tag === "INPUT" && (type === "checkbox" || type === "radio")) {
      el.checked = !!val;
    } else if (el.value !== stringify(val)) {
      el.value = stringify(val);
    }
  });
  addCleanup(el, stop);
  const event = modifiers.includes("lazy") || tag === "SELECT" ? "change" : "input";
  const handler = (e) => {
    const t = e.target;
    let value;
    if (t.type === "checkbox")
      value = t.checked;
    else if (t.type === "number")
      value = t.value === "" ? null : Number(t.value);
    else
      value = t.value;
    if (modifiers.includes("number"))
      value = parseFloat(value);
    assignPath(scope, expression, value);
  };
  el.addEventListener(event, handler);
  addCleanup(el, () => el.removeEventListener(event, handler));
}
function assignPath(scope, path, value) {
  const trimmed = path.trim();
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
function processOn(el, event, expression, scope, modifiers) {
  let target = el;
  let eventName = event;
  if (modifiers.includes("window"))
    target = window;
  if (modifiers.includes("document"))
    target = document;
  if (modifiers.includes("outside")) {
    const handler2 = (e) => {
      if (el.contains(e.target))
        return;
      run();
    };
    const run = () => evaluateAction(expression, scope, el, null);
    document.addEventListener("click", handler2);
    addCleanup(el, () => document.removeEventListener("click", handler2));
    return;
  }
  const handler = (e) => {
    if (modifiers.includes("prevent"))
      e.preventDefault();
    if (modifiers.includes("stop"))
      e.stopPropagation();
    if (modifiers.includes("once")) {
      target.removeEventListener(eventName, handler);
    }
    const expr = expression.trim();
    const self = findReactiveRoot(scope);
    if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
      const fn = evaluate(expr, scope, el);
      if (typeof fn === "function") {
        fn.call(self, e);
        return;
      }
    }
    const call = expr.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)\s*$/);
    if (call) {
      const fn = evaluate(call[1], scope, el);
      if (typeof fn === "function") {
        const argsSrc = call[2].trim();
        const args = argsSrc ? evaluate(`[${argsSrc}]`, scope, el, e) || [] : [];
        fn.apply(self, Array.isArray(args) ? args : []);
        return;
      }
    }
    evaluateAction(expr, scope, el, e);
  };
  const opts = {};
  if (modifiers.includes("passive"))
    opts.passive = true;
  if (modifiers.includes("capture"))
    opts.capture = true;
  let finalHandler = handler;
  if (modifiers.includes("debounce")) {
    let t;
    finalHandler = (e) => {
      clearTimeout(t);
      t = setTimeout(() => handler(e), 250);
    };
  }
  if (modifiers.includes("throttle")) {
    let locked = false;
    finalHandler = (e) => {
      if (locked)
        return;
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
function processFor(el, expression, scope) {
  const match = expression.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*))?\s+in\s+(.+)$/);
  if (!match) {
    console.warn("[m] bad x-for", expression);
    return;
  }
  const [, itemName, indexName, listExpr] = match;
  const keyExpr = el.getAttribute(":key") || el.getAttribute("x-bind:key") || el.getAttribute("m-bind:key") || null;
  if (keyExpr) {
    el.removeAttribute(":key");
    el.removeAttribute("x-bind:key");
    el.removeAttribute("m-bind:key");
  }
  const isTemplate = el.tagName === "TEMPLATE";
  const anchor = document.createComment(`x-for: ${expression}`);
  el.parentNode.insertBefore(anchor, el);
  el.remove();
  let lookup = new Map;
  const parentRaw = scope?.[RAW] || scope || {};
  function makeRowScope(item, index) {
    const locals = { [itemName]: item };
    if (indexName)
      locals[indexName] = index;
    else
      locals.$index = index;
    Object.setPrototypeOf(locals, parentRaw);
    return reactive(locals);
  }
  function refreshRowScope(rowScope, item, index) {
    rowScope[itemName] = item;
    if (indexName)
      rowScope[indexName] = index;
    else
      rowScope.$index = index;
  }
  const stop = effect(() => {
    let list = evaluate(listExpr, scope, anchor.parentElement);
    if (list == null)
      list = [];
    if (typeof list === "number" && Number.isFinite(list)) {
      list = Array.from({ length: list }, (_, i) => i + 1);
    }
    if (list instanceof Set || list instanceof Map) {
      list = Array.from(list);
    }
    const isArr = Array.isArray(list);
    let entries;
    if (isArr) {
      list.length;
      entries = list.map((item, i) => [i, item]);
    } else if (list && typeof list === "object") {
      entries = Object.entries(list);
    } else {
      entries = [];
    }
    const oldLookup = lookup;
    lookup = new Map;
    const plan = [];
    for (let i = 0;i < entries.length; i++) {
      const index = isArr ? i : entries[i][0];
      const item = entries[i][1];
      let key;
      if (keyExpr) {
        const keyScope = makeRowScope(item, index);
        key = evaluate(keyExpr, keyScope, anchor.parentElement);
        if (key != null && typeof key === "object") {
          console.warn("[m] x-for :key must be string/number, got object");
          key = String(i);
        }
      } else {
        key = index;
      }
      if (oldLookup.has(key)) {
        lookup.set(key, oldLookup.get(key));
        oldLookup.delete(key);
      }
      plan.push({ key, item, index });
    }
    for (const rec of oldLookup.values()) {
      for (const node of rec.nodes) {
        cleanupEl(node);
        node.remove();
      }
    }
    processFor._lastKeys = processFor._lastKeys || new WeakMap;
    const lastKeys = processFor._lastKeys.get(anchor) || [];
    const oldPos = new Map;
    for (let i = 0;i < lastKeys.length; i++)
      oldPos.set(lastKeys[i], i);
    const moveMap = [];
    for (let ni = 0;ni < plan.length; ni++) {
      const k = plan[ni].key;
      if (oldPos.has(k))
        moveMap[oldPos.get(k)] = ni;
    }
    const stay = longestIncreasingSubsequence(moveMap);
    const newKeys = [];
    let prev = anchor;
    for (let ni = 0;ni < plan.length; ni++) {
      const { key, item, index } = plan[ni];
      newKeys.push(key);
      if (lookup.has(key)) {
        const rec = lookup.get(key);
        refreshRowScope(rec.scope, item, index);
        for (const node of rec.nodes) {
          const inPlace = prev.nextSibling === node;
          if (!(stay.has(ni) && inPlace) && !inPlace && prev.parentNode) {
            prev.parentNode.insertBefore(node, prev.nextSibling);
          }
          prev = node;
        }
        continue;
      }
      const childScope = makeRowScope(item, index);
      const nodes = [];
      if (isTemplate) {
        const frag = el.content.cloneNode(true);
        const wrap = document.createElement("div");
        wrap.appendChild(frag);
        for (const kid of [...wrap.childNodes]) {
          if (kid.nodeType === 1) {
            prev.parentNode.insertBefore(kid, prev.nextSibling);
            prev = kid;
            initTree(kid, childScope);
            nodes.push(kid);
          } else {
            prev.parentNode.insertBefore(kid, prev.nextSibling);
            prev = kid;
          }
        }
      } else {
        const node = el.cloneNode(true);
        node.removeAttribute("x-for");
        node.removeAttribute("m-for");
        prev.parentNode.insertBefore(node, prev.nextSibling);
        prev = node;
        initTree(node, childScope);
        nodes.push(node);
      }
      lookup.set(key, { nodes, scope: childScope });
    }
    processFor._lastKeys.set(anchor, newKeys);
  });
  addCleanup(anchor.parentElement || document.body, () => {
    stop();
    for (const rec of lookup.values()) {
      for (const node of rec.nodes) {
        cleanupEl(node);
        node.remove();
      }
    }
    lookup.clear();
    processFor._lastKeys?.delete(anchor);
  });
}
processFor._lastKeys = undefined;
function processIf(el, expression, scope) {
  const isTemplate = el.tagName === "TEMPLATE";
  const anchor = document.createComment(`x-if: ${expression}`);
  el.parentNode.insertBefore(anchor, el);
  el.remove();
  let nodes = [];
  const stop = effect(() => {
    const show = !!evaluate(expression, scope, anchor.parentElement);
    for (const n of nodes) {
      cleanupEl(n);
      n.remove();
    }
    nodes = [];
    if (!show)
      return;
    if (isTemplate) {
      const frag = el.content.cloneNode(true);
      const wrap = document.createElement("div");
      wrap.appendChild(frag);
      let insertAfter = anchor;
      for (const kid of [...wrap.childNodes]) {
        insertAfter.parentNode.insertBefore(kid, insertAfter.nextSibling);
        insertAfter = kid;
        if (kid.nodeType === 1) {
          initTree(kid, scope);
          nodes.push(kid);
        }
      }
    } else {
      const node = el.cloneNode(true);
      node.removeAttribute("x-if");
      node.removeAttribute("m-if");
      anchor.parentNode.insertBefore(node, anchor.nextSibling);
      initTree(node, scope);
      nodes.push(node);
    }
  });
  addCleanup(anchor.parentElement || document.body, stop);
}
function initTree(el, scope) {
  const root = el === document ? document.body : el;
  walk(root, (node) => {
    const parentScope = scope || closestData(node.parentElement) || closestData(node) || {};
    const cont = processElement(node, elementData.get(node) || parentScope);
    return cont;
  });
}
function destroyTree(el) {
  cleanupEl(el);
}
var rootEl = null;
var rootFactory = null;
var rootInstance = null;
var instanceCache = new Map;
var renderCount = 0;
var alreadyRedrawing = false;
var deferredQueued = false;
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
function mountComponent(el, configOrFactory, cacheKey) {
  let instance = cacheKey && instanceCache.has(cacheKey) ? instanceCache.get(cacheKey) : null;
  const isNew = !instance;
  if (!instance) {
    instance = instantiate(configOrFactory);
    if (cacheKey)
      instanceCache.set(cacheKey, instance);
  }
  destroyTree(el);
  el.innerHTML = instance.template || "";
  elementData.set(el, instance);
  for (const child of [...el.children]) {
    initTree(child, instance);
  }
  if (isNew && typeof instance.init === "function") {
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
    if (typeof inst.destroy === "function") {
      try {
        inst.destroy();
      } catch (_) {}
    }
  }
  instanceCache.clear();
  rootInstance = null;
}
var M = {
  version: VERSION,
  reactive,
  effect,
  data(name, factory) {
    dataRegistry.set(name, factory);
    return factory;
  },
  store(name, value) {
    const bucket = storeBucket();
    const root = getStoresRoot();
    if (value === undefined) {
      return root[name];
    }
    if (bucket.has(name) && typeof value === "object" && value) {
      const existing = bucket.get(name);
      for (const k of Object.keys(value)) {
        if (typeof value[k] === "function") {
          existing[k] = value[k];
        } else if (!(k in existing)) {
          existing[k] = value[k];
        }
      }
      root[name] = existing;
      if (typeof existing.init === "function") {}
      return existing;
    }
    const data = typeof value === "function" ? value() : value;
    const proxy = reactive(data && typeof data === "object" ? data : { value: data });
    bucket.set(name, proxy);
    root[name] = proxy;
    if (typeof proxy.init === "function") {
      queueMicrotask(() => proxy.init());
    }
    return proxy;
  },
  start(root = document) {
    if (typeof document !== "undefined" && !document.getElementById("m-cloak-style")) {
      const s = document.createElement("style");
      s.id = "m-cloak-style";
      s.textContent = "[x-cloak],[m-cloak]{display:none !important;}";
      document.head.appendChild(s);
    }
    initTree(root === document ? document.body : root);
  },
  initTree,
  destroyTree,
  Router,
  createStore,
  mount(el, factory) {
    rootEl = typeof el === "string" ? document.querySelector(el) : el || document.body;
    rootFactory = factory != null ? typeof factory === "function" ? factory : () => factory : () => Router.render();
    if (!document.getElementById("m-cloak-style")) {
      const s = document.createElement("style");
      s.id = "m-cloak-style";
      s.textContent = "[x-cloak],[m-cloak]{display:none !important;}";
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
    if (alreadyRedrawing)
      return;
    alreadyRedrawing = true;
    try {
      redrawCount++;
      flushCount++;
      if (!rootEl || !rootFactory)
        return;
      const active = document.activeElement;
      const hadFocus = active && rootEl.contains(active) ? {
        name: active.name,
        id: active.id,
        start: active.selectionStart,
        end: active.selectionEnd
      } : null;
      if (!rootInstance) {
        rootInstance = instantiate(rootFactory());
        instanceCache.set("root", rootInstance);
      }
      destroyTree(rootEl);
      rootEl.innerHTML = rootInstance.template || "";
      elementData.set(rootEl, rootInstance);
      for (const child of [...rootEl.children]) {
        initTree(child, rootInstance);
      }
      if (typeof rootInstance.init === "function" && !rootInstance._inited) {
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
        const next = hadFocus.id ? rootEl.querySelector(`#${CSS.escape(hadFocus.id)}`) : hadFocus.name ? rootEl.querySelector(`[name="${hadFocus.name}"]`) : null;
        if (next && next.focus) {
          next.focus();
          if (hadFocus.start != null && "setSelectionRange" in next) {
            try {
              next.setSelectionRange(hadFocus.start, hadFocus.end);
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
  },
  get renderCount() {
    return renderCount;
  },
  get drawCallCount() {
    return flushCount;
  },
  takeDrawCalls,
  takePerfStats,
  flushSync,
  get root() {
    return rootInstance;
  },
  link: Router.link,
  evaluate,
  magic: {}
};
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
