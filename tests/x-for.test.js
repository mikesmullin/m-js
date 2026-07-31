/**
 * Keyed x-for reconciliation — Alpine-style lookup + LIS-assisted reorder.
 * (Virtual-DOM-like list updates without full tear-down.)
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installDom, uninstallDom, flush } from './setup/dom.js';
import { resetFramework, click, $$ } from './helpers.js';
import { initTree, reactive } from '../src/m.js';

beforeEach(() => {
  installDom();
  resetFramework();
});
afterEach(() => {
  resetFramework();
  uninstallDom();
});

/**
 * @param {object} scope
 * @param {string} html
 */
function mount(scope, html) {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  initTree(root, scope);
  return root;
}

describe('x-for basic', () => {
  test('renders list items', async () => {
    const scope = reactive({
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item in items" :key="item.id">
          <span x-text="item.label"></span>
        </div>
      </div>`,
    );
    await flush();
    const rows = $$ (root, '.row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent.trim()).toBe('A');
    expect(rows[1].textContent.trim()).toBe('B');
  });

  test('push adds a row without dropping others (keyed)', async () => {
    const scope = reactive({
      items: [{ id: 1, label: 'one' }],
    });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item in items" :key="item.id" :data-id="item.id">
          <span x-text="item.label"></span>
        </div>
      </div>`,
    );
    await flush();
    const first = root.querySelector('.row');
    scope.items.push({ id: 2, label: 'two' });
    await flush();
    const rows = $$(root, '.row');
    expect(rows.length).toBe(2);
    // First row node should be reused (same element identity)
    expect(rows[0]).toBe(first);
    expect(rows[1].textContent.trim()).toBe('two');
  });

  test('splice removes only the deleted key', async () => {
    const scope = reactive({
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item in items" :key="item.id">
          <span x-text="item.label"></span>
        </div>
      </div>`,
    );
    await flush();
    const before = $$(root, '.row');
    const keepA = before[0];
    const keepC = before[2];
    scope.items.splice(1, 1); // remove b
    await flush();
    const after = $$(root, '.row');
    expect(after.length).toBe(2);
    expect(after[0]).toBe(keepA);
    expect(after[1]).toBe(keepC);
    expect(after.map((r) => r.textContent.trim())).toEqual(['A', 'C']);
  });

  test('reorder preserves node identity by key', async () => {
    const scope = reactive({
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item in items" :key="item.id">
          <span x-text="item.label"></span>
        </div>
      </div>`,
    );
    await flush();
    const map = new Map(
      $$(root, '.row').map((el) => [el.textContent.trim(), el]),
    );
    scope.items = [
      { id: 'c', label: 'C' },
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    await flush();
    const after = $$(root, '.row');
    expect(after.map((r) => r.textContent.trim())).toEqual(['C', 'A', 'B']);
    expect(after[0]).toBe(map.get('C'));
    expect(after[1]).toBe(map.get('A'));
    expect(after[2]).toBe(map.get('B'));
  });

  test('in-place item field update refreshes text without remount', async () => {
    const scope = reactive({
      items: [{ id: 1, label: 'old' }],
    });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item in items" :key="item.id">
          <span class="lbl" x-text="item.label"></span>
        </div>
      </div>`,
    );
    await flush();
    const row = root.querySelector('.row');
    const span = root.querySelector('.lbl');
    scope.items[0].label = 'new';
    await flush();
    expect(root.querySelector('.row')).toBe(row);
    expect(span.textContent).toBe('new');
  });

  test('same key + new item object refreshes text (Alpine refreshScope)', async () => {
    // tabs[0] = blankTab(1) style: identity of list slot changes, :key stays
    const scope = reactive({
      items: [{ id: 1, name: 'What tool call functions' }],
    });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item in items" :key="item.id">
          <span class="name" x-text="item.name"></span>
        </div>
      </div>`,
    );
    await flush();
    const row = root.querySelector('.row');
    expect(root.querySelector('.name').textContent).toBe(
      'What tool call functions',
    );

    scope.items = [{ id: 1, name: 'Chat 1' }];
    await flush();

    // DOM row reused (same key)
    expect(root.querySelector('.row')).toBe(row);
    // Label must update via reactive row scope refresh
    expect(root.querySelector('.name').textContent).toBe('Chat 1');
  });

  test('index variable available as second binding', async () => {
    const scope = reactive({ items: ['x', 'y'] });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item, i in items">
          <span x-text="i + ':' + item"></span>
        </div>
      </div>`,
    );
    await flush();
    const texts = $$(root, '.row').map((r) => r.textContent.trim());
    expect(texts[0]).toBe('0:x');
    expect(texts[1]).toBe('1:y');
  });
});

describe('x-for with actions inside rows', () => {
  test('click handler on row mutates store (proxy this-binding)', async () => {
    const scope = reactive({
      items: [
        { id: 1, label: 'A' },
        { id: 2, label: 'B' },
      ],
      remove(id) {
        this.items = this.items.filter((x) => x.id !== id);
      },
    });
    const root = mount(
      scope,
      `<div>
        <div class="row" x-for="item in items" :key="item.id">
          <button type="button" class="del" @click="remove(item.id)">x</button>
          <span x-text="item.label"></span>
        </div>
      </div>`,
    );
    await flush();
    await click(root.querySelector('.del'));
    await flush();
    expect(scope.items.map((i) => i.id)).toEqual([2]);
    expect($$(root, '.row').length).toBe(1);
  });
});
