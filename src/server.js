/**
 * m.js v3 dev server (Bun)
 * - Serves project static files
 * - SPA fallback for docs routes
 * - WebSocket HMR via chokidar
 */

import { watch } from 'chokidar';
import { join, relative, extname } from 'path';
import { existsSync, statSync } from 'fs';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = join(import.meta.dir, '..');

/** @type {Set<import('bun').ServerWebSocket<any>>} */
const clients = new Set();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
};

function contentType(filePath) {
  return MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveFile(urlPath) {
  // Normalize, block traversal
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p.includes('\0')) return null;
  if (p === '/') p = '/index.html';

  const rel = p.replace(/^\/+/, '');
  // Prefer docs/ as site root (matches GitHub Pages /docs publish layout)
  const candidates = [
    join(ROOT, 'docs', rel),
    join(ROOT, rel),
    // legacy absolute /docs/* and /src/* paths
    rel.startsWith('docs/') || rel.startsWith('src/') ? join(ROOT, rel) : null,
  ].filter(Boolean);

  for (const abs of candidates) {
    if (!abs.startsWith(ROOT)) continue;
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
    const asIndex = join(abs, 'index.html');
    if (existsSync(asIndex) && statSync(asIndex).isFile()) return asIndex;
  }
  return null;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);

    // WebSocket upgrade for HMR
    if (url.pathname === '/__m_hmr') {
      if (srv.upgrade(req)) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // Health
    if (url.pathname === '/__m_health') {
      return Response.json({ ok: true, clients: clients.size, version: '3.0.0' });
    }

    let filePath = resolveFile(url.pathname);

    // SPA fallback: non-file routes under docs → docs/index.html
    if (!filePath) {
      const isAsset = /\.\w{1,8}$/.test(url.pathname);
      if (!isAsset) {
        filePath = join(ROOT, 'docs/index.html');
      }
    }

    if (!filePath || !existsSync(filePath)) {
      return new Response('Not found: ' + url.pathname, { status: 404 });
    }

    const file = Bun.file(filePath);
    return new Response(file, {
      headers: {
        'Content-Type': contentType(filePath),
        'Cache-Control': 'no-store',
      },
    });
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      ws.send(JSON.stringify({ type: 'connected', version: '3.0.0' }));
    },
    close(ws) {
      clients.delete(ws);
    },
    message() {},
  },
});

// Watch source + docs for HMR
const watcher = watch(
  [join(ROOT, 'src'), join(ROOT, 'docs')],
  {
    ignoreInitial: true,
    ignored: [
      /(^|[\/\\])\../,
      /node_modules/,
      /tmp/,
    ],
  },
);

function broadcast(path) {
  const rel = relative(ROOT, path).split('\\').join('/');
  const payload = JSON.stringify({ type: 'change', path: '/' + rel });
  for (const ws of clients) {
    try {
      ws.send(payload);
    } catch (_) {}
  }
  console.log(`[hmr] ${rel} → ${clients.size} client(s)`);
}

let debounce = null;
/** @type {Set<string>} */
const pending = new Set();

watcher.on('all', (event, path) => {
  if (event !== 'change' && event !== 'add') return;
  pending.add(path);
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    for (const p of pending) broadcast(p);
    pending.clear();
  }, 50);
});

console.log(`
  m.js v3 dev server
  ──────────────────
  Local:   http://localhost:${PORT}
  Docs:    http://localhost:${PORT}/
  Health:  http://localhost:${PORT}/__m_health
  HMR:     ws://localhost:${PORT}/__m_hmr
`);
