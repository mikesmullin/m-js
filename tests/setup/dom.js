/**
 * Browser environment mock for m-js unit tests (happy-dom).
 * Import first in every DOM-related test file.
 */
import { Window } from 'happy-dom';

/** @type {Window | null} */
let windowRef = null;

/**
 * Install a fresh happy-dom window on globalThis.
 * @param {{ url?: string }} [opts]
 */
export function installDom(opts = {}) {
  const win = new Window({
    url: opts.url || 'http://localhost:3000/',
  });

  // Core globals m-js / Router / hot-client expect
  const g = globalThis;
  g.window = win;
  g.document = win.document;
  g.HTMLElement = win.HTMLElement;
  g.Element = win.Element;
  g.Node = win.Node;
  g.Text = win.Text;
  g.Comment = win.Comment;
  g.DocumentFragment = win.DocumentFragment;
  g.CustomEvent = win.CustomEvent;
  g.Event = win.Event;
  g.MouseEvent = win.MouseEvent;
  g.KeyboardEvent = win.KeyboardEvent;
  g.MutationObserver = win.MutationObserver;
  g.getComputedStyle = win.getComputedStyle.bind(win);
  g.requestAnimationFrame =
    win.requestAnimationFrame?.bind(win) ||
    ((cb) => setTimeout(() => cb(Date.now()), 0));
  g.cancelAnimationFrame =
    win.cancelAnimationFrame?.bind(win) || ((id) => clearTimeout(id));
  g.queueMicrotask =
    g.queueMicrotask || ((fn) => Promise.resolve().then(fn));

  // location / history (happy-dom provides these on window)
  g.location = win.location;
  g.history = win.history;
  g.navigator = win.navigator;

  // HMR store buckets
  win.__M_ALPINE_STORES__ = new Map();
  win.__M_STORES__ = new Map();

  windowRef = win;
  return win;
}

export function getWindow() {
  return windowRef;
}

/**
 * Tear down DOM + HMR buckets (call in afterEach).
 */
export function uninstallDom() {
  if (windowRef) {
    try {
      windowRef.happyDOM?.close?.();
    } catch {
      /* ignore */
    }
  }
  windowRef = null;
  const g = globalThis;
  delete g.window;
  delete g.document;
}

/**
 * Flush microtasks + macrotasks + rAF (effects schedule on requestAnimationFrame).
 * @param {number} [times]
 */
export async function flush(times = 3) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    // Drain rAF callbacks (happy-dom / polyfill often uses setTimeout(0))
    await new Promise((r) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => r(undefined));
      } else {
        setTimeout(r, 0);
      }
    });
    await new Promise((r) => setTimeout(r, 0));
  }
}

/**
 * @param {string} html
 * @returns {HTMLElement}
 */
export function mountHost(html = '<div id="app"></div>') {
  document.body.innerHTML = html;
  return /** @type {HTMLElement} */ (document.getElementById('app') || document.body.firstElementChild);
}
