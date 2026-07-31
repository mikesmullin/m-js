/**
 * Client-side router — ported & simplified from m.js v2 (M.mjs).
 * Pathname-based; preserves URL across HMR.
 */

const RX_ABSOLUTE_URL = /^(?:\w{1,99}:)?\/\//;

/** @type {Map<string, { uri: string, title: string, rx: RegExp, fn: Function }>} */
const routes = new Map();

/** @type {string} */
let currentUri = '';

/** @type {((title: string) => string) | null} */
let formatTitle = null;

/** @type {(() => void) | null} */
let onChange = null;

/** @type {Record<string, string>} */
let params = {};

export class Router {
  static get uri() {
    return currentUri;
  }

  static get params() {
    return params;
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
    // Convert :param segments to named capture groups
    const pattern = uri
      .replace(/\//g, '\\/')
      .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '(?<$1>[^/]+)');
    routes.set(uri, {
      uri,
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
    for (const route of routes.values()) {
      const m = uri.match(route.rx);
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
   * Navigate to uri (pushState + redraw).
   * @param {string} uri
   */
  static set(uri) {
    const path = uri.split('?')[0].split('#')[0] || '/';
    if (currentUri === path && Object.keys(params).length === 0) {
      // still allow first paint
    }
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
    const full = uri.startsWith('/') ? uri : path;
    if (window.location.pathname + window.location.search !== full) {
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
            <a href="/" class="text-cyan-400 underline" m-on:click="goHome">Go home</a>
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
    const path = window.location.pathname || '/';
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
   * Click handler for internal links — use as m-on:click or onclick.
   * @param {MouseEvent} e
   */
  static link(e) {
    const anchor = /** @type {Element} */ (e.currentTarget || e.target);
    if (!anchor) return;
    const el = anchor.closest?.('a') || anchor;
    const href = el.getAttribute?.('href');
    if (href == null) return;
    if (RX_ABSOLUTE_URL.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return; // let browser handle absolute
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      window.open(`${window.location.origin}${href}`);
    } else {
      Router.set(href);
    }
    return false;
  }

  static start() {
    window.addEventListener('popstate', Router._popstate, false);
    // Initial sync without double-push
    const path = window.location.pathname || '/';
    const matched = Router.match(path);
    currentUri = path;
    params = matched?.params ?? {};
    if (matched) {
      let title = matched.route.title;
      if (typeof formatTitle === 'function') title = formatTitle(title);
      if (typeof title === 'string' && title) document.title = title;
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
