/**
 * Docs app — dogfoods m.js v3
 * Uses dynamic imports so HMR can cache-bust page modules.
 */
import M from './m/m.js';
import { Router } from './m/router.js';

window.__M__ = { M, m: M, Router };

/**
 * @param {number} [bust] cache-bust token for HMR
 */
async function boot(bust = 0) {
  const q = bust ? `?t=${bust}` : '';

  const [
    { default: Layout },
    { default: Home },
    { default: Guide },
    { default: Api },
    { default: Storybook },
    { default: HmrDemo },
  ] = await Promise.all([
    import(`./components/layout.js${q}`),
    import(`./pages/home.js${q}`),
    import(`./pages/guide.js${q}`),
    import(`./pages/api.js${q}`),
    import(`./pages/storybook.js${q}`),
    import(`./pages/hmr.js${q}`),
  ]);

  Router.reset();
  // GitHub Pages project site: https://user.github.io/m-js/ → base "/m-js"
  Router.detectBase();
  Router.setTitleFormat((t) => (t ? `${t} · m.js` : 'm.js v3'));

  const page = (factory) => () => Layout({ page: factory() });

  Router.register('/', 'Home', page(Home));
  Router.register('/guide', 'Guide', page(Guide));
  Router.register('/api', 'API', page(Api));
  Router.register('/storybook', 'Storybook', page(Storybook));
  Router.register('/hmr', 'HMR Demo', page(HmrDemo));
  Router.rewrite('/index.html', '/');

  if (!window.__M_APP_MOUNTED__) {
    window.__M_APP_MOUNTED__ = true;
    M.mount('#app');
    console.info('[docs] m.js v3 mounted', M.version, 'base=', Router.base || '(root)');
  } else {
    // HMR: drop view instances (stores + URL keep), redraw with new modules
    M.invalidate();
    Router.detectBase();
    Router.syncFromLocation();
    M.deferredBatchRedraw();
    console.info('[docs] m.js hot reloaded', bust, 'base=', Router.base || '(root)');
  }
}

// First load
await boot(0);

// Expose for hot-client
window.__M_BOOT__ = boot;

export { boot };
export default { boot };
