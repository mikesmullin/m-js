/**
 * m.js docs site (orphan `docs` branch)
 * Framework documentation only — UI storybook lives at m-js-components.
 *
 * Runtime is the cloud-hosted CDN bundle (same URL any site can copy-paste):
 *   https://mikesmullin.github.io/m-js/dist/m.min.js
 */
import M, { Router } from 'https://mikesmullin.github.io/m-js/dist/m.min.js';

window.__M__ = { M, m: M, Router };

/**
 * @param {number} [bust]
 */
async function boot(bust = 0) {
  const q = bust ? `?t=${bust}` : '';

  const [
    { default: Layout },
    { default: Home },
    { default: Guide },
    { default: Api },
    { default: HmrDemo },
  ] = await Promise.all([
    import(`./components/layout.js${q}`),
    import(`./pages/home.js${q}`),
    import(`./pages/guide.js${q}`),
    import(`./pages/api.js${q}`),
    import(`./pages/hmr.js${q}`),
  ]);

  Router.reset();
  Router.detectBase();
  Router.setTitleFormat((t) => (t ? `${t} · m.js` : 'm.js v3'));

  const page = (factory) => () => Layout({ page: factory() });

  Router.register('/', 'Home', page(Home));
  Router.register('/guide', 'Guide', page(Guide));
  Router.register('/api', 'API', page(Api));
  Router.register('/hmr', 'HMR Demo', page(HmrDemo));
  Router.rewrite('/index.html', '/');

  if (!window.__M_APP_MOUNTED__) {
    window.__M_APP_MOUNTED__ = true;
    M.mount('#app');
    console.info('[docs] m.js v3.1.2 mounted', M.version, 'base=', Router.base || '(root)');
  } else {
    M.invalidate();
    Router.detectBase();
    Router.syncFromLocation();
    M.deferredBatchRedraw();
    console.info('[docs] m.js hot reloaded', bust);
  }
}

await boot(0);
window.__M_BOOT__ = boot;
export { boot };
export default { boot };
