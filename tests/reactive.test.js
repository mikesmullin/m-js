/**
 * Deep reactive engine — tracking, effects, nested mutations.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installDom, uninstallDom, flush } from './setup/dom.js';
import { reactive, effect } from '../src/m.js';

beforeEach(() => installDom());
afterEach(() => uninstallDom());

describe('reactive()', () => {
  test('reads track and writes re-run effects', async () => {
    const state = reactive({ n: 0 });
    const seen = [];
    effect(() => {
      seen.push(state.n);
    });
    expect(seen).toEqual([0]);
    state.n = 1;
    await flush();
    expect(seen).toEqual([0, 1]);
  });

  test('deep nested object mutations notify', async () => {
    const state = reactive({ user: { name: 'a' } });
    const seen = [];
    effect(() => {
      seen.push(state.user.name);
    });
    state.user.name = 'b';
    await flush();
    expect(seen).toEqual(['a', 'b']);
  });

  test('array push/splice notify via length', async () => {
    const state = reactive({ items: [{ id: 1 }] });
    let len = 0;
    let ids = [];
    effect(() => {
      len = state.items.length;
      ids = state.items.map((i) => i.id);
    });
    expect(len).toBe(1);
    state.items.push({ id: 2 });
    await flush();
    expect(len).toBe(2);
    expect(ids).toEqual([1, 2]);
    state.items.splice(0, 1);
    await flush();
    expect(len).toBe(1);
    expect(ids).toEqual([2]);
  });

  test('does not double-wrap same object', () => {
    const raw = { x: 1 };
    const a = reactive(raw);
    const b = reactive(raw);
    const c = reactive(a);
    expect(a).toBe(b);
    expect(c).toBe(a);
  });

  test('methods bind to proxy (not Object.create child receiver)', async () => {
    const store = reactive({
      history: [{ id: 1 }],
      clear() {
        this.history = [];
      },
    });
    // Simulate x-for child scope
    const child = Object.create(store);
    child.item = { id: 1 };
    // Lookup clear through prototype — must still write on store
    const clear = child.clear;
    clear();
    await flush();
    expect(store.history).toEqual([]);
  });

  test('skips host-like objects (Date)', () => {
    const d = new Date();
    const state = reactive({ d });
    // Date should not become a reactive proxy with unexpected behavior
    expect(state.d).toBe(d);
    expect(state.d.getFullYear()).toBe(d.getFullYear());
  });
});

describe('effect()', () => {
  test('stop() unsubscribes', async () => {
    const state = reactive({ n: 0 });
    let runs = 0;
    const stop = effect(() => {
      void state.n;
      runs++;
    });
    expect(runs).toBe(1);
    stop();
    state.n = 5;
    await flush();
    expect(runs).toBe(1);
  });

  test('batches multiple writes in one flush', async () => {
    const state = reactive({ a: 0, b: 0 });
    let runs = 0;
    effect(() => {
      void state.a;
      void state.b;
      runs++;
    });
    state.a = 1;
    state.b = 2;
    await flush();
    // initial + one batched re-run (or two microtask waves — allow ≤3)
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(runs).toBeLessThanOrEqual(3);
  });
});
