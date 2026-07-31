import { Router } from '../../m/router.js';

export default function IconLink(attrs = {}) {
  const {
    href = '#',
    icon = '',
    label = '',
    class: className = '',
    disabled = false,
    onclick = null,
  } = attrs;

  return {
    template: `
      <a
        href="${href}"
        class="inline-flex items-center gap-2 ${className}"
        :class="{ 'opacity-40': disabled, 'pointer-events-none': disabled }"
        @click="handleClick"
      >
        <i x-show="icon" class="ph ${icon ? 'ph-' + icon : ''}"></i>
        <span x-show="label" x-text="label"></span>
      </a>
    `,
    icon,
    label,
    disabled,
    handleClick(e) {
      if (this.disabled) {
        e.preventDefault();
        return false;
      }
      if (typeof onclick === 'function') return onclick.call(this, e);
      if (href && href !== '#') return Router.link(e);
    },
  };
}
