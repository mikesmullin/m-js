/**
 * M.mount / redraw / component templates / magics integration.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installDom, uninstallDom, flush } from './setup/dom.js';
import { resetFramework, click, mountHost } from './helpers.js';
import { M } from '../src/m.js';

beforeEach(() => {
  installDom();
  resetFramework();
});
afterEach(() => {
  resetFramework();
  uninstallDom();
});

describe('M.mount', () => {
  test('renders template into root and binds scope', async () => {
    mountHost('<div id="app"></div>');
    M.mount('#app', () => ({
      template: `
        <div class="wrap">
          <span x-text="label"></span>
          <button type="button" @click="label = 'B'">go</button>
        </div>
      `,
      label: 'A',
    }));
    await flush();
    const root = document.getElementById('app');
    expect(root.querySelector('span').textContent).toBe('A');
    await click(root.querySelector('button'));
    expect(root.querySelector('span').textContent).toBe('B');
  });

  test('invalidate + remount keeps M.store data', async () => {
    mountHost('<div id="app"></div>');
    M.store('app', { n: 1 });
    M.mount('#app', () => ({
      template: `<p x-text="$store.app.n"></p>`,
    }));
    await flush();
    M.store('app').n = 99;
    await flush();
    M.invalidate();
    M.mount('#app', () => ({
      template: `<p class="v" x-text="$store.app.n"></p>`,
    }));
    await flush();
    expect(document.querySelector('.v').textContent).toBe('99');
  });

  test('version is exposed', () => {
    expect(M.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('m-mount nested components', () => {
  test('nests child template from parent scope', async () => {
    mountHost('<div id="app"></div>');
    M.mount('#app', () => ({
      template: `
        <div>
          <div class="slot" m-mount="child"></div>
        </div>
      `,
      child: {
        template: `<em class="nested" x-text="msg"></em>`,
        msg: 'nested-ok',
      },
    }));
    await flush();
    expect(document.querySelector('.nested')?.textContent).toBe('nested-ok');
  });
});
