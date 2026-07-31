/**
 * HMR client — connects to the m.js dev server WebSocket.
 * CSS: swap stylesheets in place.
 * JS: re-run window.__M_BOOT__(timestamp) so the app dynamically re-imports
 *     modules with cache bust. Named stores + Router URL are preserved.
 */

const HMR_PROTO = location.protocol === 'https:' ? 'wss' : 'ws';
const HMR_URL = `${HMR_PROTO}://${location.host}/__m_hmr`;

/** @type {((path: string) => void|Promise<void>) | null} */
let customHandler = null;

/**
 * @param {(path: string) => void|Promise<void>} fn
 */
export function onHotReload(fn) {
  customHandler = fn;
}

function reloadCss(href) {
  const clean = href.split('?')[0];
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  let found = false;
  for (const link of links) {
    const url = new URL(/** @type {HTMLLinkElement} */ (link).href, location.href);
    if (
      url.pathname === clean ||
      url.pathname.endsWith(clean) ||
      clean.endsWith(url.pathname)
    ) {
      const next = /** @type {HTMLLinkElement} */ (link.cloneNode());
      next.href = url.pathname + '?t=' + Date.now();
      next.onload = () => link.remove();
      link.parentNode.insertBefore(next, link.nextSibling);
      found = true;
    }
  }
  if (!found) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = clean + '?t=' + Date.now();
    document.head.appendChild(link);
  }
  console.debug('[m.hmr] css', clean);
}

async function reloadJs(path) {
  console.debug('[m.hmr] js', path);
  if (customHandler) {
    await customHandler(path);
    return;
  }
  const bust = Date.now();
  // Preload the changed module with cache bust (helps when boot re-imports it)
  if (path && (path.startsWith('/') || path.startsWith('./'))) {
    const url = path.startsWith('/') ? path : '/' + path;
    try {
      await import(url + '?t=' + bust);
    } catch (_) {
      /* page modules may not be side-effect free; boot will re-import */
    }
  }
  if (typeof window.__M_BOOT__ === 'function') {
    try {
      await window.__M_BOOT__(bust);
      console.debug('[m.hmr] boot ok', bust);
    } catch (err) {
      console.error('[m.hmr] boot failed, full reload', err);
      location.reload();
    }
  } else {
    // Fallback: re-import app entry (may not bust transitive deps)
    const entry = document.querySelector('script[data-hmr-entry]');
    const src =
      entry?.getAttribute('src') ||
      entry?.getAttribute('data-src') ||
      '/docs/app.js';
    try {
      await import(src.split('?')[0] + '?t=' + bust);
    } catch (err) {
      console.error('[m.hmr] import failed, full reload', err);
      location.reload();
    }
  }
}

function connect() {
  let ws;
  try {
    ws = new WebSocket(HMR_URL);
  } catch (e) {
    console.warn('[m.hmr] websocket unavailable', e);
    return;
  }

  ws.addEventListener('open', () => {
    console.debug('[m.hmr] connected');
    document.documentElement.dataset.hmr = 'connected';
  });

  ws.addEventListener('message', async (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.type === 'change') {
      const file = msg.path || '';
      document.documentElement.dataset.hmr = 'updating';
      document.documentElement.dataset.hmrFile = file;
      try {
        if (/\.css$/i.test(file)) {
          reloadCss(file.startsWith('/') ? file : '/' + file);
        } else if (/\.(js|mjs|ts)$/i.test(file)) {
          await reloadJs(file);
        } else if (/\.html$/i.test(file)) {
          location.reload();
          return;
        }
      } finally {
        document.documentElement.dataset.hmr = 'connected';
        window.dispatchEvent(
          new CustomEvent('m:hmr', { detail: { path: file } }),
        );
      }
    } else if (msg.type === 'connected') {
      console.debug('[m.hmr] server hello', msg);
    }
  });

  ws.addEventListener('close', () => {
    document.documentElement.dataset.hmr = 'disconnected';
    setTimeout(connect, 1000);
  });

  ws.addEventListener('error', () => {
    ws.close();
  });
}

if (typeof window !== 'undefined' && !window.__M_HMR_STARTED__) {
  window.__M_HMR_STARTED__ = true;
  connect();
}

export default { onHotReload, connect };
