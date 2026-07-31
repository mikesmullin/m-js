export default function CounterField(attrs = {}) {
  const {
    count = 0,
    color = 'secondary',
    class: className = '',
    title = '',
    icon = '',
    dontHideZero = false,
  } = attrs;

  return {
    template: `
      <span
        class="m-tooltip-wrap ${className}"
        x-show="dontHideZero || count !== 0"
      >
        <span x-show="title" class="m-tooltip" x-text="title"></span>
        <span class="m-badge m-badge-${color}">
          <i x-show="icon" class="ph ${icon ? 'ph-' + icon : ''}"></i>
          <span x-text="count"></span>
        </span>
      </span>
    `,
    count,
    title,
    icon,
    dontHideZero,
  };
}
