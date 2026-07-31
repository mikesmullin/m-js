/**
 * M.store (Alpine $store) + createStore (Zustand-style) HMR survival.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installDom, uninstallDom, flush } from './setup/dom.js';
import { resetFramework } from './helpers.js';
import { M } from '../src/m.js';
import { createStore, clearStore } from '../src/store.js';

beforeEach(() => {
  installDom();
  resetFramework();
});
afterEach(() => {
  resetFramework();
  uninstallDom();
});

describe('M.store', () => {
  test('creates and reads named store', () => {
    const s = M.store('demo', { n: 1, inc() { this.n++; } });
    expect(M.store('demo')).toBe(s);
    expect(s.n).toBe(1);
    s.inc();
    expect(s.n).toBe(2);
  });

  test('HMR re-register merges methods and keeps data', () => {
    const s1 = M.store('hmr', { n: 5, old() { return this.n; } });
    s1.n = 42;
    const s2 = M.store('hmr', {
      n: 0, // must NOT overwrite existing
      old() { return -1; },
      neu() { return this.n * 2; },
    });
    expect(s2).toBe(s1);
    expect(s2.n).toBe(42);
    expect(typeof s2.neu).toBe('function');
    expect(s2.neu()).toBe(84);
    // method slot updated
    expect(s2.old()).toBe(-1);
  });

  test('survives across window HMR bucket', () => {
    M.store('persist', { v: 'yes' });
    expect(window.__M_ALPINE_STORES__.has('persist')).toBe(true);
    expect(M.store('persist').v).toBe('yes');
  });

  test('nested mutations are reactive for $store consumers', async () => {
    const { effect } = await import('../src/m.js');
    const cart = M.store('cart2', { items: [] });
    let len = -1;
    effect(() => {
      len = cart.items.length;
    });
    cart.items.push({ id: 1 });
    await flush();
    expect(len).toBe(1);
  });
});

describe('createStore (zustand-style)', () => {
  test('setState / getState / subscribe', () => {
    const api = createStore((set, get) => ({
      bears: 0,
      add: () => set({ bears: get().bears + 1 }),
    }));
    const seen = [];
    const unsub = api.subscribe((s) => seen.push(s.bears));
    api.getState().add();
    expect(api.getState().bears).toBe(1);
    expect(seen).toEqual([1]);
    unsub();
    api.getState().add();
    expect(seen).toEqual([1]);
  });

  test('named store reuses instance (HMR)', () => {
    const a = createStore(() => ({ x: 1 }), { name: 'z1' });
    a.setState({ x: 9 });
    const b = createStore(() => ({ x: 0 }), { name: 'z1' });
    expect(b).toBe(a);
    expect(b.getState().x).toBe(9);
    clearStore('z1');
    const c = createStore(() => ({ x: 0 }), { name: 'z1' });
    expect(c).not.toBe(a);
    expect(c.getState().x).toBe(0);
  });

  test('replace flag swaps state object', () => {
    const api = createStore(() => ({ a: 1, b: 2 }));
    api.setState({ a: 3 }, true);
    expect(api.getState()).toEqual({ a: 3 });
  });
});
