/**
 * Shared test helpers for m-js.
 */
import { flush, mountHost } from './setup/dom.js';
import { initTree, destroyTree, M } from '../src/m.js';
import { Router } from '../src/router.js';

export { flush, mountHost };

/**
 * Parse HTML string into a live element under body and run initTree.
 * @param {string} html outer HTML of root
 * @param {object} [scope]
 * @returns {HTMLElement}
 */
export function mountHtml(html, scope) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  const el = /** @type {HTMLElement} */ (wrap.firstElementChild);
  document.body.appendChild(el);
  if (scope) {
    // Attach scope via a synthetic x-data root if needed
    initTree(el, scope);
  } else {
    initTree(el);
  }
  return el;
}

/**
 * Mount a component factory via M.mount into #app.
 * @param {() => object} factory
 */
export async function mountApp(factory) {
  mountHost('<div id="app"></div>');
  M.invalidate();
  M.mount('#app', factory);
  await flush();
  return document.getElementById('app');
}

/**
 * Reset router + stores between tests.
 */
export function resetFramework() {
  Router.stop();
  Router.reset();
  Router.setBase('');
  Router.onChange(() => {});
  if (typeof window !== 'undefined') {
    window.__M_ALPINE_STORES__ = new Map();
    window.__M_STORES__ = new Map();
  }
  // Drop M root if any
  try {
    M.unmount();
  } catch {
    /* ignore */
  }
  M.invalidate();
  document.body.innerHTML = '';
}

/**
 * Click an element and flush effects.
 * @param {Element} el
 */
export async function click(el) {
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
  );
  await flush();
}

/**
 * Input into a form control (x-model).
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} el
 * @param {string} value
 */
export async function typeInput(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}

/**
 * @param {Element} root
 * @param {string} selector
 */
export function $(root, selector) {
  return root.querySelector(selector);
}

/**
 * @param {Element} root
 * @param {string} selector
 */
export function $$(root, selector) {
  return [...root.querySelectorAll(selector)];
}
