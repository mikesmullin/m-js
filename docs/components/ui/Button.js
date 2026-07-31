/**
 * Button — Alpine-style template (unclebensrice Button.mjs)
 *
 * Usage:
 *   M.data('btn', Button)
 *   <div x-data="btn({ label: 'Save', color: 'primary' })">…</div>
 * or factory return for m-mount / storybook.
 */
export default function Button(attrs = {}) {
  const {
    tagName = 'button',
    type = 'button',
    color = 'secondary',
    id = '',
    class: className = '',
    icon = '',
    label = '',
    title = '',
    disabled = false,
    onclick = null,
    size = '',
  } = attrs;

  const sizeClass = size === 'sm' ? 'm-btn-sm' : size === 'lg' ? 'm-btn-lg' : '';
  const colorClass = `m-btn-${color}`;

  return {
    template: `
      <${tagName}
        ${type && tagName === 'button' ? `type="${type}"` : ''}
        ${id ? `id="${id}"` : ''}
        class="m-btn ${colorClass} ${sizeClass} ${className}"
        ${title ? `title="${title}"` : ''}
        :disabled="disabled"
        @click="handleClick"
      >
        <i x-show="icon" class="ph ${icon ? 'ph-' + icon : ''}"></i>
        <span x-show="label" x-text="label"></span>
      </${tagName}>
    `,
    disabled,
    icon,
    label,
    handleClick(e) {
      if (this.disabled) {
        e.preventDefault();
        return false;
      }
      if (typeof onclick === 'function') return onclick.call(this, e);
    },
  };
}
