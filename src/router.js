/**
 * Client-side router — ported & simplified from m.js v2 (M.mjs).
 * Pathname-based; preserves URL across HMR.
 *
 * Supports a base path for project sites (e.g. GitHub Pages `/m-js`):
 *   Router.setBase('/m-js')  or auto-detect via Router.detectBase()
 */

const RX_ABSOLUTE_URL = /^(?:\w{1,99}:)?\/\//;

/** @type {Map<string, { uri: string, title: string, rx: RegExp, fn: Function }>} */
const routes = new Map();

/** @type {string} app path without base, e.g. "/" or "/guide" */
let currentUri = '';

/** @type {string} mount prefix with no trailing slash, e.g. "/m-js" or "" */
let basePath = '';

/** @type {((title: string) => string) | null} */
let formatTitle = null;

/** @type {(() => void) | null} */
let onChange = null;

/** @type {Record<string, string>} */
let params = {};

/** Normalize to leading slash, no trailing slash (except root). */
function normalizePath(uri) {
  let p = (uri || '/').split('?')[0].split('#')[0] || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

/**
 * Strip basePath from a browser pathname → app route.
 * @param {string} pathname
 */
function stripBase(pathname) {
  let path = pathname || '/';
  if (basePath) {
    if (path === basePath || path === basePath + '/') {
      path = '/';
    } else if (path.startsWith(basePath + '/')) {
      path = path.slice(basePath.length) || '/';
    }
  }
  return normalizePath(path);
}

/**
 * App route → full browser path (with base).
 * @param {string} uri
 */
function withBase(uri) {
  const path = normalizePath(uri);
  if (!basePath) return path === '/' ? '/' : path;
  if (path === '/') return basePath + '/';
  return basePath + path;
}

export class Router {
  static get uri() {
    return currentUri;
  }

  static get params() {
    return params;
  }

  /** Current site base (e.g. "/m-js" on GitHub Pages), or "". */
  static get base() {
    return basePath;
  }

  /**
   * Set URL base prefix for subdirectory hosting (no trailing slash).
   * @param {string} base  e.g. "/m-js"
   */
  static setBase(base) {
    basePath = (base || '').replace(/\/+$/, '');
    if (basePath === '/') basePath = '';
  }

  /**
   * Infer base from the entry module script URL, &lt;base href&gt;, or github.io.
   * Example: script at /m-js/app.js → base "/m-js".
   * @returns {string}
   */
  static detectBase() {
    const basetag = document.querySelector('base[href]');
    if (basetag) {
      try {
        const u = new URL(/** @type {HTMLBaseElement} */ (basetag).href, location.origin);
        const dir = u.pathname.replace(/\/+$/, '');
        if (dir && dir !== '/') {
          Router.setBase(dir);
          return basePath;
        }
      } catch (_) {}
    }

    const scripts = document.querySelectorAll(
      'script[type="module"][src], script[data-hmr-entry][src]',
    );
    for (const s of scripts) {
      const src = s.getAttribute('src');
      if (!src || src.startsWith('data:')) continue;
      try {
        const u = new URL(src, location.href);
        if (u.origin !== location.origin) continue;
        const dir = u.pathname.replace(/\/[^/]*$/, '');
        if (dir && dir !== '/') {
          Router.setBase(dir);
          return basePath;
        }
      } catch (_) {}
    }

    // github.io project pages: /<repo>/...
    if (/\.github\.io$/i.test(location.hostname)) {
      const parts = location.pathname.split('/').filter(Boolean);
      if (parts.length >= 1) {
        Router.setBase('/' + parts[0]);
        return basePath;
      }
    }

    Router.setBase('');
    return '';
  }

  /**
   * @param {(title: string) => string} [fn]
   */
  static setTitleFormat(fn) {
    formatTitle = fn;
  }

  /**
   * @param {() => void} fn  called after route changes (usually m.redraw)
   */
  static onChange(fn) {
    onChange = fn;
  }

  /**
   * Register a route. `fn` returns a component config (or vnode-like).
   * @param {string} uri  path pattern, e.g. "/" or "/storybook/:id"
   * @param {string} title
   * @param {Function} fn
   */
  static register(uri, title, fn) {
    const path = normalizePath(uri);
    const pattern = path
      .replace(/\//g, '\\/')
      .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '(?<$1>[^/]+)');
    routes.set(path, {
      uri: path,
      title,
      rx: new RegExp(`^${pattern}$`),
      fn,
    });
  }

  static rewrite(from, to) {
    Router.register(from, '', () => {
      Router.set(to);
      return { template: '' };
    });
  }

  /**
   * @param {string} uri
   * @returns {{ route: object, params: Record<string,string> } | null}
   */
  static match(uri) {
    const path = normalizePath(uri);
    for (const route of routes.values()) {
      const m = path.match(route.rx);
      if (m) {
        return {
          route,
          params: m.groups ? { ...m.groups } : {},
        };
      }
    }
    return null;
  }

  static get() {
    return currentUri;
  }

  /**
   * Navigate to app uri (pushState + redraw). Pass app paths like "/" or "/guide".
   * @param {string} uri
   */
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
    if (typeof formatTitle === 'function') {
      title = formatTitle(title);
    }
    if (typeof title === 'string' && title) {
      document.title = title;
    }
    const full = withBase(path);
    if (window.location.pathname !== full) {
      window.history.pushState(null, title || '', full);
    }
    onChange?.();
  }

  /**
   * Render the active route's component factory.
   * @returns {object|null}
   */
  static render() {
    const matched = Router.match(currentUri);
    if (!matched) {
      return {
        template: `
          <div class="p-12 text-center">
            <h1 class="text-4xl font-bold text-pink-400 mb-4">404</h1>
            <p class="text-cyan-200/70 mb-6">No route for <code class="text-cyan-300">${escapeHtml(currentUri)}</code></p>
            <a href="${withBase('/')}" class="text-cyan-400 underline" @click="goHome">Go home</a>
          </div>
        `,
        goHome(e) {
          e.preventDefault();
          Router.set('/');
        },
      };
    }
    return matched.route.fn(params);
  }

  static _popstate() {
    Router.syncFromLocation();
  }

  static syncFromLocation() {
    const path = stripBase(window.location.pathname || '/');
    const matched = Router.match(path);
    currentUri = path;
    params = matched?.params ?? {};
    if (matched) {
      let title = matched.route.title;
      if (typeof formatTitle === 'function') title = formatTitle(title);
      if (typeof title === 'string' && title) document.title = title;
    }
    onChange?.();
  }

  /**
   * Click handler for internal links — use as @click or m-on:click.
   * @param {MouseEvent} e
   */
  static link(e) {
    const anchor = /** @type {Element} */ (e.currentTarget || e.target);
    if (!anchor) return;
    const el = anchor.closest?.('a') || anchor;
    const href = el.getAttribute?.('href');
    if (href == null) return;
    if (RX_ABSOLUTE_URL.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    // Accept both app paths ("/guide") and base-prefixed ("/m-js/guide")
    let appPath = href;
    if (basePath && (href === basePath || href === basePath + '/' || href.startsWith(basePath + '/'))) {
      appPath = stripBase(href);
    }
    if (e.ctrlKey || e.metaKey) {
      window.open(`${window.location.origin}${withBase(appPath)}`);
    } else {
      Router.set(appPath);
    }
    return false;
  }

  /**
   * Prefix an app path for use in href attributes.
   * @param {string} uri
   */
  static href(uri) {
    return withBase(uri);
  }

  static start() {
    if (!basePath) Router.detectBase();
    window.addEventListener('popstate', Router._popstate, false);
    const path = stripBase(window.location.pathname || '/');
    const matched = Router.match(path);
    currentUri = path;
    params = matched?.params ?? {};
    if (matched) {
      let title = matched.route.title;
      if (typeof formatTitle === 'function') title = formatTitle(title);
      if (typeof title === 'string' && title) document.title = title;
      // Keep address bar under base (e.g. /m-js/ not bare host path)
      const full = withBase(path);
      if (window.location.pathname !== full) {
        window.history.replaceState(null, title || '', full);
      }
    }
  }

  static stop() {
    window.removeEventListener('popstate', Router._popstate, false);
  }

  /** @returns {string[]} */
  static list() {
    return [...routes.keys()];
  }

  static reset() {
    routes.clear();
    currentUri = '';
    params = {};
    // keep basePath across reset (HMR re-registers routes)
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default Router;
