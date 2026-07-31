import { Router } from '../../m/router.js';

export default function Link(attrs = {}) {
  const {
    href = '#',
    id = '',
    class: className = '',
    target = '',
    label = '',
    disabled = false,
    onclick = null,
  } = attrs;

  return {
    template: `
      <a
        ${id ? `id="${id}"` : ''}
        href="${href}"
        class="${className}"
        ${target ? `target="${target}"` : ''}
        :class="{ 'opacity-40': disabled, 'pointer-events-none': disabled }"
        @click="handleClick"
      >
        <span x-text="label"></span>
      </a>
    `,
    href,
    label,
    disabled,
    handleClick(e) {
      if (this.disabled) {
        e.preventDefault();
        return false;
      }
      if (typeof onclick === 'function') return onclick.call(this, e);
      return Router.link(e);
    },
  };
}
