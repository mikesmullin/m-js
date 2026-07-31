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
