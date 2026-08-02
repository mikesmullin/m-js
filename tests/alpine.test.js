/**
 * Alpine-compatible directives & magics (x-text, x-show, x-model, @click, …).
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installDom, uninstallDom, flush } from './setup/dom.js';
import { mountHtml, click, typeInput, resetFramework, $ } from './helpers.js';
import { M, reactive, initTree } from '../src/m.js';

beforeEach(() => {
  installDom();
  resetFramework();
});
afterEach(() => {
  resetFramework();
  uninstallDom();
});

describe('x-text / x-html / x-show', () => {
  test('x-text binds textContent', async () => {
    const el = mountHtml(
      `<div x-data="{ msg: 'hi' }"><span x-text="msg"></span></div>`,
    );
    await flush();
    expect(el.querySelector('span').textContent).toBe('hi');
  });

  test('x-html sets innerHTML', async () => {
    const el = mountHtml(
      `<div x-data="{ h: '<b>x</b>' }"><div class="t" x-html="h"></div></div>`,
    );
    await flush();
    expect(el.querySelector('.t').innerHTML).toContain('<b>');
  });

  test('x-show toggles display', async () => {
    const el = mountHtml(`
      <div x-data="{ open: false }">
        <div class="panel" x-show="open">secret</div>
        <button type="button" @click="open = !open">t</button>
      </div>
    `);
    await flush();
    const panel = el.querySelector('.panel');
    expect(panel.style.display).toBe('none');
    await click(el.querySelector('button'));
    expect(panel.style.display).not.toBe('none');
  });
});

describe('x-model / @click / :class', () => {
  test('x-model two-way binds input', async () => {
    const el = mountHtml(`
      <div x-data="{ name: '' }">
        <input x-model="name" />
        <span x-text="name"></span>
      </div>
    `);
    await flush();
    const input = el.querySelector('input');
    await typeInput(input, 'Ada');
    expect(el.querySelector('span').textContent).toBe('Ada');
  });

  test('@click runs statements and methods', async () => {
    const el = mountHtml(`
      <div x-data="{ n: 0, inc(){ this.n++ } }">
        <button type="button" class="a" @click="n++">a</button>
        <button type="button" class="b" @click="inc">b</button>
        <span x-text="n"></span>
      </div>
    `);
    await flush();
    await click(el.querySelector('.a'));
    expect(el.querySelector('span').textContent).toBe('1');
    await click(el.querySelector('.b'));
    expect(el.querySelector('span').textContent).toBe('2');
  });

  test(':class and :title attribute binds', async () => {
    // Bind on the same node as x-data (child :class is covered indirectly by pie UI)
    const el = mountHtml(`
      <div
        class="box"
        x-data="{ enabled: true, title: 'hello' }"
        :title="title"
        :aria-label="enabled ? 'on' : 'off'"
      >
        <button type="button" @click="enabled = false; title = 'bye'">x</button>
      </div>
    `);
    await flush();
    expect(el.getAttribute('title')).toBe('hello');
    expect(el.getAttribute('aria-label')).toBe('on');
    await click(el.querySelector('button'));
    expect(el.getAttribute('title')).toBe('bye');
    expect(el.getAttribute('aria-label')).toBe('off');
  });

  test(':class string toggles tokens without freezing them (Alpine undo)', async () => {
    // Regression: brain viz sidebar — dynamic "collapsed" must leave when false.
    const el = mountHtml(`
      <div x-data="{ collapsed: true }">
        <div
          class="panel"
          id="side"
          :class="'panel' + (collapsed ? ' collapsed' : '')"
        ></div>
        <button type="button" @click="collapsed = !collapsed">t</button>
      </div>
    `);
    await flush();
    const side = el.querySelector('#side');
    expect(side.classList.contains('panel')).toBe(true);
    expect(side.classList.contains('collapsed')).toBe(true);
    await click(el.querySelector('button'));
    expect(side.classList.contains('panel')).toBe(true);
    expect(side.classList.contains('collapsed')).toBe(false);
    await click(el.querySelector('button'));
    expect(side.classList.contains('collapsed')).toBe(true);
  });

  test(':class + :style on same node — style must not freeze class (Alpine)', async () => {
    // The old m-js path snapshotted className into data-static-class on EVERY
    // bind, so :style registered after :class had painted "collapsed" and
    // permanently re-merged it on each update.
    const el = mountHtml(`
      <div x-data="{ collapsed: true, w: 200 }">
        <aside
          id="side"
          :class="'panel' + (collapsed ? ' collapsed' : '')"
          :style="{ width: w + 'px', '--sidebar-w': w + 'px' }"
        ></aside>
        <button type="button" class="open" @click="collapsed = false">open</button>
        <button type="button" class="wide" @click="w = 320">wide</button>
      </div>
    `);
    await flush();
    const side = /** @type {HTMLElement} */ (el.querySelector('#side'));
    expect(side.classList.contains('collapsed')).toBe(true);
    expect(side.style.width).toBe('200px');
    expect(side.style.getPropertyValue('--sidebar-w')).toBe('200px');

    await click(el.querySelector('.open'));
    expect(side.classList.contains('collapsed')).toBe(false);
    expect(side.classList.contains('panel')).toBe(true);

    // Changing style alone must not resurrect collapsed
    await click(el.querySelector('.wide'));
    expect(side.style.width).toBe('320px');
    expect(side.style.getPropertyValue('--sidebar-w')).toBe('320px');
    expect(side.classList.contains('collapsed')).toBe(false);
    // Must not accumulate "panel panel panel…" either
    const panels = side.className.split(/\s+/).filter((t) => t === 'panel');
    expect(panels.length).toBe(1);
  });

  test(':class object form adds and removes by boolean', async () => {
    const el = mountHtml(`
      <div x-data="{ on: false }">
        <div id="box" class="base" :class="{ active: on, dim: !on }"></div>
        <button type="button" @click="on = !on">t</button>
      </div>
    `);
    await flush();
    const box = el.querySelector('#box');
    expect(box.classList.contains('base')).toBe(true);
    expect(box.classList.contains('dim')).toBe(true);
    expect(box.classList.contains('active')).toBe(false);
    await click(el.querySelector('button'));
    expect(box.classList.contains('active')).toBe(true);
    expect(box.classList.contains('dim')).toBe(false);
    expect(box.classList.contains('base')).toBe(true);
  });

  test(':disabled boolean binding', async () => {
    const el = mountHtml(`
      <div x-data="{ busy: true }">
        <button type="button" class="go" :disabled="busy">Go</button>
      </div>
    `);
    await flush();
    expect(el.querySelector('.go').disabled).toBe(true);
  });
});

describe('x-if / x-ref / $refs / $nextTick', () => {
  test('x-if mounts and unmounts', async () => {
    const el = mountHtml(`
      <div x-data="{ show: false }">
        <div x-if="show" class="only">here</div>
        <button type="button" @click="show = true">s</button>
      </div>
    `);
    await flush();
    expect(el.querySelector('.only')).toBeNull();
    await click(el.querySelector('button'));
    expect(el.querySelector('.only')?.textContent).toBe('here');
  });

  test('x-ref and $refs', async () => {
    let got = null;
    // Use M.data so we can capture $refs in a method
    M.data('refdemo', () => ({
      grab() {
        got = this.$refs.box?.className;
      },
    }));
    // $refs is magic on evaluate — methods need to use magics via template @click
    const el = mountHtml(`
      <div x-data="refdemo">
        <div x-ref="box" class="target"></div>
        <button type="button" @click="$refs.box.classList.add('ok')">g</button>
      </div>
    `);
    await flush();
    await click(el.querySelector('button'));
    expect(el.querySelector('.target').classList.contains('ok')).toBe(true);
  });
});

describe('M.data named components', () => {
  test('x-data="name" uses registry factory', async () => {
    M.data('counter', () => ({
      n: 1,
      inc() {
        this.n++;
      },
    }));
    const el = mountHtml(`
      <div x-data="counter">
        <span x-text="n"></span>
        <button type="button" @click="inc">+</button>
      </div>
    `);
    await flush();
    expect(el.querySelector('span').textContent).toBe('1');
    await click(el.querySelector('button'));
    expect(el.querySelector('span').textContent).toBe('2');
  });
});

describe('x-init / x-effect / x-cloak', () => {
  test('x-init runs on mount', async () => {
    const el = mountHtml(`
      <div x-data="{ n: 0 }" x-init="n = 7">
        <span x-text="n"></span>
      </div>
    `);
    await flush();
    expect(el.querySelector('span').textContent).toBe('7');
  });

  test('x-cloak attribute is removed after process', async () => {
    const el = mountHtml(`
      <div x-data="{}" x-cloak class="root">
        <span>x</span>
      </div>
    `);
    await flush();
    expect(el.hasAttribute('x-cloak')).toBe(false);
  });
});

describe('$store magic', () => {
  test('$store reads M.store', async () => {
    M.store('cart', { qty: 2 });
    const el = mountHtml(`
      <div x-data>
        <span x-text="$store.cart.qty"></span>
      </div>
    `);
    await flush();
    expect(el.querySelector('span').textContent).toBe('2');
    M.store('cart').qty = 9;
    await flush();
    expect(el.querySelector('span').textContent).toBe('9');
  });
});
