/**
 * Storybook — interactive gallery using Alpine x-* + thin component factories
 */
import M from '../m/m.js';
import Button from '../components/ui/Button.js';
import TextInput from '../components/ui/TextInput.js';
import CounterField from '../components/ui/CounterField.js';
import DropDownMenu from '../components/ui/DropDownMenu.js';
import Tooltip from '../components/ui/Tooltip.js';
import FilterInput from '../components/ui/FilterInput.js';
import RefreshButton from '../components/ui/RefreshButton.js';
import Table from '../components/ui/Table.js';
import IconLink from '../components/ui/IconLink.js';

const SAMPLE_ROWS = [
  { id: 1, name: 'Neon Cipher', status: 'active', score: 98 },
  { id: 2, name: 'Pink Pulse', status: 'idle', score: 72 },
  { id: 3, name: 'Void Walker', status: 'active', score: 85 },
  { id: 4, name: 'Cyan Drift', status: 'error', score: 41 },
  { id: 5, name: 'Purple Haze', status: 'active', score: 90 },
];

export default function Storybook() {
  return {
    template: `
      <article class="space-y-12">
        <header class="space-y-2">
          <p class="text-cyan-400/80 font-mono text-sm uppercase tracking-widest">Storybook</p>
          <h1 class="text-3xl font-bold text-white">UI components</h1>
          <p class="text-slate-400 max-w-2xl">
            Reusable components with <code class="text-pink-300">x-*</code> directives.
            Ported from the unclebensrice client framework.
          </p>
        </header>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-hand-pointing"></i> Button
          </h2>
          <div class="story-frame flex flex-wrap gap-3 items-center">
            <div m-mount="btnPrimary"></div>
            <div m-mount="btnSecondary"></div>
            <div m-mount="btnDanger"></div>
            <div m-mount="btnSuccess"></div>
            <div m-mount="btnDisabled"></div>
            <div m-mount="btnIcon"></div>
          </div>
          <p class="text-xs text-slate-500" x-text="buttonMsg"></p>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-textbox"></i> TextInput
          </h2>
          <div class="story-frame max-w-md space-y-4">
            <div m-mount="inputName"></div>
            <div m-mount="inputEmail"></div>
            <p class="text-sm text-slate-400">
              Live value: <code class="text-pink-300" x-text="inputName?.value || '…'"></code>
            </p>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-hash"></i> CounterField
          </h2>
          <div class="story-frame flex flex-wrap gap-4 items-center">
            <div m-mount="counter1"></div>
            <div m-mount="counter2"></div>
            <div m-mount="counter0"></div>
            <button type="button" class="m-btn m-btn-secondary m-btn-sm" @click="bumpCounter">
              <i class="ph ph-plus"></i> Bump
            </button>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-caret-down"></i> DropDownMenu
          </h2>
          <div class="story-frame flex flex-wrap gap-4 items-start min-h-[120px]">
            <div m-mount="menu"></div>
            <p class="text-sm text-slate-400" x-text="menuMsg"></p>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-chat-teardrop-text"></i> Tooltip
          </h2>
          <div class="story-frame">
            <div m-mount="tooltip"></div>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-funnel"></i> FilterInput
          </h2>
          <div class="story-frame space-y-4">
            <div m-mount="filter"></div>
            <ul class="text-sm space-y-1">
              <li x-for="row in filteredRows" class="text-slate-300 flex items-center gap-2">
                <i class="ph ph-dot text-cyan-500"></i>
                <span x-text="row.name"></span>
                <span class="text-slate-600" x-text="'· ' + row.status"></span>
              </li>
            </ul>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-arrows-clockwise"></i> RefreshButton
          </h2>
          <div class="story-frame flex items-center gap-4">
            <div m-mount="refresh"></div>
            <span class="text-sm text-slate-400" x-text="refreshMsg"></span>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-link"></i> IconLink
          </h2>
          <div class="story-frame flex flex-wrap gap-4">
            <div m-mount="iconLink1"></div>
            <div m-mount="iconLink2"></div>
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-table"></i> Table
          </h2>
          <div class="story-frame" m-mount="table"></div>
        </section>

        <!-- Inline Alpine playground (no factory methods) -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-cyan-200 flex items-center gap-2">
            <i class="ph ph-flask"></i> Inline x-data playground
          </h2>
          <div class="story-frame" x-data="{ open: false, n: 0 }">
            <button type="button" class="m-btn m-btn-primary" @click="open = !open; n++">
              Toggle (<span x-text="n"></span>)
            </button>
            <div x-show="open" x-transition class="mt-3 text-sm text-cyan-200">
              Pure Alpine-style markup — no component methods needed.
            </div>
          </div>
        </section>
      </article>
    `,

    buttonMsg: 'Click a button…',
    menuMsg: 'Pick an action…',
    refreshMsg: 'Idle',
    filterQuery: '',
    count: 3,
    rows: SAMPLE_ROWS,

    btnPrimary: null,
    btnSecondary: null,
    btnDanger: null,
    btnSuccess: null,
    btnDisabled: null,
    btnIcon: null,
    inputName: null,
    inputEmail: null,
    counter1: null,
    counter2: null,
    counter0: null,
    menu: null,
    tooltip: null,
    filter: null,
    refresh: null,
    iconLink1: null,
    iconLink2: null,
    table: null,

    get filteredRows() {
      const q = (this.filterQuery || '').toLowerCase();
      if (!q) return this.rows;
      return this.rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q),
      );
    },

    init() {
      this.wireChildren();
    },

    wireChildren() {
      const self = this;
      const msg = (t) => {
        self.buttonMsg = t;
      };

      this.btnPrimary = Button({
        color: 'primary',
        label: 'Primary',
        icon: 'sparkle',
        onclick: () => msg('Primary clicked'),
      });
      this.btnSecondary = Button({
        color: 'secondary',
        label: 'Secondary',
        onclick: () => msg('Secondary clicked'),
      });
      this.btnDanger = Button({
        color: 'danger',
        label: 'Danger',
        icon: 'warning',
        onclick: () => msg('Danger clicked'),
      });
      this.btnSuccess = Button({
        color: 'success',
        label: 'Success',
        icon: 'check',
        onclick: () => msg('Success clicked'),
      });
      this.btnDisabled = Button({
        color: 'secondary',
        label: 'Disabled',
        disabled: true,
      });
      this.btnIcon = Button({
        color: 'primary',
        icon: 'heart',
        title: 'Icon only',
        onclick: () => msg('♥'),
      });

      this.inputName = TextInput({
        label: 'Display name',
        name: 'displayName',
        placeholder: 'Ada Lovelace',
        description: 'Shown on your public profile',
      });
      this.inputEmail = TextInput({
        label: 'Email',
        name: 'email',
        type: 'email',
        placeholder: 'ada@analytical.engine',
        invalid: 'Please enter a valid email (demo)',
      });

      this.counter1 = CounterField({
        count: this.count,
        color: 'primary',
        title: 'Active jobs',
        icon: 'activity',
        dontHideZero: true,
      });
      this.counter2 = CounterField({
        count: 12,
        color: 'danger',
        title: 'Errors',
        icon: 'warning-circle',
      });
      this.counter0 = CounterField({
        count: 0,
        color: 'secondary',
        title: 'Hidden when zero',
      });

      this.menu = DropDownMenu({
        label: 'Actions',
        labelIcon: 'list',
        options: [
          {
            icon: 'pencil-simple',
            label: 'Edit',
            onclick: () => {
              self.menuMsg = 'Edit selected';
            },
          },
          {
            icon: 'copy',
            label: 'Duplicate',
            onclick: () => {
              self.menuMsg = 'Duplicated';
            },
          },
          {
            icon: 'trash',
            label: 'Delete',
            danger: true,
            onclick: () => {
              self.menuMsg = 'Delete requested';
            },
          },
          { icon: 'lock', label: 'Locked', disabled: true },
        ],
      });

      this.tooltip = Tooltip({
        label: 'Hover for a neon tooltip',
        content: 'CSS tooltip — Alpine x-text',
        class: 'm-btn m-btn-secondary',
      });

      this.filter = FilterInput({
        placeholder: 'Filter by name or status…',
        matchedCount: this.filteredRows.length,
        onsearch: (q) => {
          self.filterQuery = q;
          if (self.filter) self.filter.matchedCount = self.filteredRows.length;
        },
      });

      this.refresh = RefreshButton({
        async onrefresh() {
          self.refreshMsg = 'Fetching…';
          await new Promise((r) => setTimeout(r, 800));
          self.refreshMsg = 'Refreshed at ' + new Date().toLocaleTimeString();
        },
      });

      this.iconLink1 = IconLink({
        href: '/guide',
        icon: 'book-open-text',
        label: 'Read the guide',
        class: 'text-cyan-400 hover:text-pink-400 transition',
      });
      this.iconLink2 = IconLink({
        href: 'https://github.com/mikesmullin/m-js',
        icon: 'github-logo',
        label: 'GitHub',
        class: 'text-slate-400 hover:text-white transition',
        onclick(e) {
          e.preventDefault();
          window.open('https://github.com/mikesmullin/m-js', '_blank');
        },
      });

      this.table = Table({
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status', format: (v) => v.toUpperCase() },
          { key: 'score', label: 'Score' },
        ],
        rows: this.rows,
      });
    },

    bumpCounter() {
      this.count++;
      if (this.counter1) this.counter1.count = this.count;
    },
  };
}
