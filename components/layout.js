/**
 * Docs shell — framework docs nav (storybook is a separate repo)
 */
import { Router } from '../dist/m.min.js';

const NAV = [
  { path: '/', label: 'Home', icon: 'house' },
  { path: '/guide', label: 'Guide', icon: 'book-open-text', match: '/guide' },
  { path: '/api', label: 'API', icon: 'code', match: '/api' },
  { path: '/hmr', label: 'HMR Demo', icon: 'lightning', match: '/hmr' },
];

export default function Layout(attrs = {}) {
  const page = attrs.page || { template: '' };

  return {
    template: `
      <div class="min-h-screen flex flex-col lg:flex-row">
        <aside class="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-cyan-500/10 bg-void-900/60 backdrop-blur-md">
          <div class="sticky top-0 p-5 flex flex-col gap-6 max-h-screen overflow-y-auto">
            <header class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/30 to-pink-500/30 border border-cyan-400/40 flex items-center justify-center shadow-neon">
                <span class="font-mono font-bold text-cyan-300 text-lg">m</span>
              </div>
              <div>
                <a :href="homeHref" class="font-semibold text-lg tracking-tight text-white hover:text-cyan-300 transition" @click="go">m.js</a>
                <div class="text-xs text-cyan-400/70 font-mono">v3.1.1</div>
              </div>
            </header>

            <nav class="flex flex-col gap-1">
              <a
                x-for="item in navItems"
                :href="item.href"
                class="nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-cyan-300 hover:bg-cyan-400/5 transition"
                :class="{ active: isActive(item) }"
                @click="go"
              >
                <i class="ph text-lg" :class="'ph-' + item.icon"></i>
                <span x-text="item.label"></span>
              </a>
              <a
                href="https://mikesmullin.github.io/m-js-components/"
                class="nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-cyan-300 hover:bg-cyan-400/5 transition"
                target="_blank"
                rel="noopener"
              >
                <i class="ph ph-squares-four text-lg"></i>
                <span>Storybook</span>
                <i class="ph ph-arrow-square-out text-xs opacity-50 ml-auto"></i>
              </a>
            </nav>

            <div class="mt-auto pt-4 border-t border-cyan-500/10 space-y-2 text-xs text-slate-500">
              <div class="flex items-center gap-2">
                <span class="hmr-dot"></span>
                <span>HMR <span class="text-slate-400" x-text="hmrStatus"></span></span>
              </div>
              <a href="https://github.com/mikesmullin/m-js" target="_blank" class="neon-link inline-flex items-center gap-1">
                <i class="ph ph-github-logo"></i> GitHub
              </a>
            </div>
          </div>
        </aside>

        <div class="flex-1 min-w-0 flex flex-col">
          <main class="flex-1 px-6 py-8 lg:px-10 lg:py-10 max-w-7xl w-full mx-auto" m-mount="page"></main>
          <footer class="px-6 py-6 text-center text-xs text-slate-600 border-t border-cyan-500/5">
            License MIT · m.js v3
          </footer>
        </div>
      </div>
    `,
    page,
    get homeHref() {
      return Router.href('/');
    },
    get navItems() {
      return NAV.map((item) => ({
        ...item,
        href: Router.href(item.path),
      }));
    },
    get hmrStatus() {
      return document.documentElement.dataset.hmr || '…';
    },
    isActive(item) {
      const uri = Router.uri;
      if (item.match) return uri === item.match || uri.startsWith(item.match + '/');
      return uri === item.path;
    },
    go: Router.link,
  };
}
