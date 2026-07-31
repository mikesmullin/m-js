/**
 * Pathname Router — base path, match, set, link, HMR reset.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installDom, uninstallDom, flush } from './setup/dom.js';
import { resetFramework } from './helpers.js';
import { Router } from '../src/router.js';

beforeEach(() => {
  installDom({ url: 'http://localhost:3000/' });
  resetFramework();
  Router.setBase('');
  Router.reset();
});
afterEach(() => {
  Router.stop();
  Router.reset();
  Router.setBase('');
  uninstallDom();
});

describe('Router.match / register', () => {
  test('registers and matches static routes', () => {
    Router.register('/', 'Home', () => ({ template: 'home' }));
    Router.register('/guide', 'Guide', () => ({ template: 'guide' }));
    expect(Router.match('/').route.title).toBe('Home');
    expect(Router.match('/guide').route.title).toBe('Guide');
    expect(Router.match('/nope')).toBeNull();
  });

  test('param routes populate params', () => {
    Router.register('/users/:id', 'User', () => ({}));
    const m = Router.match('/users/42');
    expect(m).not.toBeNull();
    expect(m.params.id).toBe('42');
  });

  test('list() returns registered paths', () => {
    Router.register('/a', 'A', () => ({}));
    Router.register('/b', 'B', () => ({}));
    expect(Router.list().sort()).toEqual(['/a', '/b']);
  });
});

describe('Router.set / uri / render', () => {
  test('set updates uri and history', () => {
    Router.register('/', 'Home', () => ({ template: '<p>h</p>' }));
    Router.register('/about', 'About', () => ({ template: '<p>a</p>' }));
    Router.start();
    Router.set('/about');
    expect(Router.uri).toBe('/about');
    expect(window.location.pathname).toBe('/about');
    const conf = Router.render();
    expect(conf.template).toContain('a');
  });

  test('404 render for unknown path', () => {
    Router.register('/', 'Home', () => ({ template: 'h' }));
    Router.set('/missing');
    const conf = Router.render();
    expect(conf.template).toContain('404');
  });

  test('onChange fires on navigation', () => {
    let n = 0;
    Router.onChange(() => {
      n++;
    });
    Router.register('/x', 'X', () => ({}));
    Router.set('/x');
    expect(n).toBeGreaterThanOrEqual(1);
  });
});

describe('Router base path (GitHub Pages style)', () => {
  test('href and set respect base', () => {
    Router.setBase('/m-js');
    Router.register('/', 'Home', () => ({}));
    Router.register('/guide', 'Guide', () => ({}));
    expect(Router.href('/guide')).toBe('/m-js/guide');
    expect(Router.href('/')).toBe('/m-js/');
    // Simulate being on base
    window.history.replaceState(null, '', '/m-js/');
    Router.start();
    Router.set('/guide');
    expect(Router.uri).toBe('/guide');
    expect(window.location.pathname).toBe('/m-js/guide');
  });

  test('reset clears routes but keeps base until setBase', () => {
    Router.setBase('/app');
    Router.register('/z', 'Z', () => ({}));
    Router.reset();
    expect(Router.list()).toEqual([]);
    expect(Router.base).toBe('/app');
    Router.setBase('');
    expect(Router.base).toBe('');
  });
});

describe('Router.link', () => {
  test('intercepts internal anchor clicks', async () => {
    Router.register('/', 'Home', () => ({}));
    Router.register('/docs', 'Docs', () => ({}));
    Router.start();
    const a = document.createElement('a');
    a.setAttribute('href', '/docs');
    document.body.appendChild(a);
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    // link expects currentTarget
    Object.defineProperty(ev, 'currentTarget', { value: a });
    Router.link(ev);
    await flush();
    expect(Router.uri).toBe('/docs');
  });

  test('ignores absolute external URLs', () => {
    Router.register('/', 'Home', () => ({}));
    Router.start();
    const a = document.createElement('a');
    a.setAttribute('href', 'https://example.com/x');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'currentTarget', { value: a });
    const pathBefore = Router.uri;
    Router.link(ev);
    // should not navigate app router to external
    expect(Router.uri).toBe(pathBefore || '/');
  });
});
