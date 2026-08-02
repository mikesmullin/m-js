/**
 * Docs home — CDN drop-in + live editable playground
 */
import { Router } from '../dist/m.min.js';

const CDN_URL = 'https://mikesmullin.github.io/m-js/dist/m.min.js';

/**
 * Editor example: real page skeleton (doctype/html/body/#app) + the module
 * script. Meta/charset and styles are intentionally omitted — the preview
 * injects minimal styles so the demo stays focused on m.js usage.
 */
const DEFAULT_SOURCE = `<!DOCTYPE html>
<html lang="en">
<body>
  <div id="app"></div>
  <script type="module">
    import M from '${CDN_URL}'

    M.mount('#app', () => ({
      count: 0,
      template: \`
        <button type="button" @click="count++" x-text="count">0</button>
      \`,
    }))
  </script>
</body>
</html>
`;

/** Implicit preview styles only (not shown in the editor). */
const PREVIEW_STYLES =
  'body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#0a0a1a;color:#e2e8f0}' +
  'button{font:inherit;padding:.6rem 1rem;border:1px solid #334155;border-radius:6px;background:#1e293b;color:inherit;cursor:pointer}';

/** Injected into the preview iframe so runtime/syntax errors report to the parent. */
const ERROR_BRIDGE = `
<script>
(function () {
  function report(msg) {
    try {
      parent.postMessage({ source: 'm-playground', type: 'error', message: String(msg) }, '*');
    } catch (_) {}
  }
  window.addEventListener('error', function (e) {
    report(e.message || (e.error && e.error.message) || e.error || 'Script error');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    report(r && r.message ? r.message : r || 'Unhandled rejection');
  });
})();
</script>
`;

function injectBridge(html) {
  const bridge = ERROR_BRIDGE.trim();
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${bridge}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${bridge}</head>`);
  }
  return `${bridge}\n${html}`;
}

/**
 * Build a preview document from editor source.
 * Always injects minimal styles (and an error bridge). Full documents are
 * left otherwise intact; bare fragments still get a small shell.
 */
function buildPreviewHtml(source) {
  const src = (source || '').trim();
  const styleTag = `<style>${PREVIEW_STYLES}</style>`;
  const isFullDoc = /<!DOCTYPE/i.test(src) || /<html[\s>]/i.test(src);

  if (isFullDoc) {
    let html = src;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${styleTag}`);
    } else {
      // No <head> in the example — add one so preview styles apply.
      html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${styleTag}</head>`);
    }
    return injectBridge(html);
  }

  // Fragment: wrap with a minimal shell so the preview still works.
  const body = /id\s*=\s*["']app["']/.test(src)
    ? src
    : `<div id="app"></div>\n${src}`;

  return injectBridge(`<!DOCTYPE html>
<html lang="en">
<head>
${styleTag}
</head>
<body>
${body}
</body>
</html>`);
}

/** Active home playground instance — single window message listener. */
let activePlayground = null;

if (typeof window !== 'undefined' && !window.__M_PLAYGROUND_MSG__) {
  window.__M_PLAYGROUND_MSG__ = true;
  window.addEventListener('message', (ev) => {
    const data = ev.data;
    if (!data || data.source !== 'm-playground' || !activePlayground) return;
    if (data.type === 'error') {
      activePlayground.error = data.message || 'Unknown error';
    }
  });
}

export default function Home() {
  return {
    cdnUrl: CDN_URL,
    copied: false,
    error: '',
    source: DEFAULT_SOURCE,

    _view: null,
    _frame: null,
    _debounce: null,
    _copyTimer: null,
    _cmLoading: false,

    template: `
      <article class="space-y-10">
        <header class="space-y-4">
          <p class="text-cyan-400/80 font-mono text-sm tracking-widest uppercase">m.js · v3</p>
          <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
            <span class="bg-gradient-to-r from-cyan-300 via-blue-300 to-pink-400 bg-clip-text text-transparent">
              Minimalist UI
            </span>
            <br />for the modern web
          </h1>
          <p class="text-lg text-slate-400 max-w-2xl leading-relaxed">
            Alpine-style <code class="text-pink-300">x-*</code> directives, <code class="text-pink-300">$store</code>,
            client Router, and hot reload — zero runtime deps, Bun for dev. API is <code class="text-pink-300">M.*</code>.
          </p>
          <div class="flex flex-wrap gap-3 pt-2">
            <a href="/guide" class="m-btn m-btn-primary m-btn-lg" @click="go">
              <i class="ph ph-rocket-launch"></i> Get started
            </a>
            <a href="https://mikesmullin.github.io/m-js-components/" class="m-btn m-btn-secondary m-btn-lg" target="_blank" rel="noopener">
              <i class="ph ph-squares-four"></i> Storybook
            </a>
            <a href="/hmr" class="m-btn m-btn-secondary m-btn-lg" @click="go">
              <i class="ph ph-lightning"></i> HMR demo
            </a>
          </div>
        </header>

        <section class="grid sm:grid-cols-3 gap-4">
          <div class="neon-card p-5 space-y-2">
            <i class="ph ph-code text-2xl text-cyan-400"></i>
            <h3 class="font-semibold text-white">x-* directives</h3>
            <p class="text-sm text-slate-400">Same conventions as Alpine.js — logic in the markup, thinner JS.</p>
          </div>
          <div class="neon-card p-5 space-y-2">
            <i class="ph ph-database text-2xl text-pink-400"></i>
            <h3 class="font-semibold text-white">$store</h3>
            <p class="text-sm text-slate-400"><code class="text-pink-300">M.store()</code> — global reactive data that survives HMR.</p>
          </div>
          <div class="neon-card p-5 space-y-2">
            <i class="ph ph-git-branch text-2xl text-purple-400"></i>
            <h3 class="font-semibold text-white">Router + HMR</h3>
            <p class="text-sm text-slate-400">Pathname routing keeps your place. Edit a file — the page updates, state stays.</p>
          </div>
        </section>

        <section id="home-playground" class="space-y-4">
          <header class="space-y-3">
            <h2 class="text-xl font-semibold text-cyan-200">Hello, Alpine-style</h2>
            <div class="text-sm text-slate-400 space-y-1 leading-relaxed">
              <p>Drop the minified ESM build onto any page — no install required.</p>
              <p>Served from GitHub Pages at</p>
              <div class="cdn-url-row">
                <code class="cdn-url" x-text="cdnUrl"></code>
                <button
                  type="button"
                  class="m-btn m-btn-secondary m-btn-sm copy-btn"
                  @click="copyCdn"
                  :title="copied ? 'Copied!' : 'Copy URL'"
                >
                  <i class="ph" :class="copied ? 'ph-check-circle text-green-400' : 'ph-copy'"></i>
                  <span x-text="copied ? 'Copied' : 'Copy'"></span>
                </button>
              </div>
            </div>
          </header>

          <div class="playground-grid">
            <div class="playground-pane">
              <div class="playground-pane-label">
                <i class="ph ph-code"></i> Edit
              </div>
              <div class="playground-editor" data-editor></div>
            </div>
            <div class="playground-pane">
              <div class="playground-pane-label">
                <i class="ph ph-eye"></i> Preview
              </div>
              <div
                class="playground-error"
                x-show="error"
                x-text="error"
              ></div>
              <iframe
                class="playground-frame"
                data-preview
                title="Live preview"
                sandbox="allow-scripts"
              ></iframe>
            </div>
          </div>
          <p class="text-xs text-slate-500">
            Edit the example on the left — the sandboxed preview updates as you type
            (minimal styles are applied in the preview only).
            Errors appear above the preview (no DevTools needed).
          </p>
        </section>
      </article>
    `,

    go: Router.link,

    init() {
      activePlayground = this;
      // Defer until the m-mount host has painted our template
      queueMicrotask(() => this.setupPlayground());
    },

    async copyCdn() {
      try {
        await navigator.clipboard.writeText(this.cdnUrl);
        this.copied = true;
        clearTimeout(this._copyTimer);
        this._copyTimer = setTimeout(() => {
          this.copied = false;
        }, 1600);
      } catch {
        this.error = 'Could not copy to clipboard — select the URL and copy manually.';
      }
    },

    setupPlayground() {
      if (activePlayground !== this) return;
      const root = document.getElementById('home-playground');
      if (!root) return;

      const editorHost = root.querySelector('[data-editor]');
      const frame = root.querySelector('[data-preview]');
      if (!editorHost || !frame) return;

      this._frame = /** @type {HTMLIFrameElement} */ (frame);

      // Avoid double-mounting CodeMirror on the same host
      if (editorHost.dataset.cmReady === '1' && this._view) {
        this.refreshPreview();
        return;
      }

      this.mountEditor(editorHost);
    },

    async mountEditor(host) {
      if (this._cmLoading) return;
      this._cmLoading = true;
      try {
        const [
          { EditorView, basicSetup },
          { html },
          { oneDark },
        ] = await Promise.all([
          import('https://esm.sh/codemirror@6'),
          import('https://esm.sh/@codemirror/lang-html@6'),
          import('https://esm.sh/@codemirror/theme-one-dark@6'),
        ]);

        if (this._view) {
          this._view.destroy();
          this._view = null;
        }
        host.innerHTML = '';

        const self = this;
        this._view = new EditorView({
          doc: this.source,
          extensions: [
            basicSetup,
            html(),
            oneDark,
            EditorView.theme({
              '&': {
                height: '100%',
                fontSize: '13px',
              },
              '.cm-scroller': {
                fontFamily:
                  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                lineHeight: '1.55',
              },
              '.cm-content': {
                padding: '12px 0',
              },
            }),
            EditorView.updateListener.of((update) => {
              if (!update.docChanged) return;
              self.source = update.state.doc.toString();
              self.schedulePreview();
            }),
          ],
          parent: host,
        });

        host.dataset.cmReady = '1';
        this.refreshPreview();
      } catch (e) {
        this.error = `CodeMirror failed to load: ${e?.message || e}`;
        if (!host.querySelector('textarea')) {
          const ta = document.createElement('textarea');
          ta.className = 'playground-fallback';
          ta.value = this.source;
          ta.addEventListener('input', () => {
            this.source = ta.value;
            this.schedulePreview();
          });
          host.appendChild(ta);
          this.refreshPreview();
        }
      } finally {
        this._cmLoading = false;
      }
    },

    schedulePreview() {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => this.refreshPreview(), 350);
    },

    refreshPreview() {
      if (!this._frame) return;
      this.error = '';
      const html = this._view ? this._view.state.doc.toString() : this.source;
      this.source = html;

      try {
        this._frame.srcdoc = buildPreviewHtml(html);
      } catch (e) {
        this.error = e?.message || String(e);
      }
    },

    destroy() {
      clearTimeout(this._debounce);
      clearTimeout(this._copyTimer);
      if (activePlayground === this) activePlayground = null;
      if (this._view) {
        this._view.destroy();
        this._view = null;
      }
      this._frame = null;
    },
  };
}
