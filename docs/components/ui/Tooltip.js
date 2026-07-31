export default function Tooltip(attrs = {}) {
  const {
    content = '',
    class: className = '',
    label = 'Hover me',
  } = attrs;

  return {
    template: `
      <span class="m-tooltip-wrap ${className}">
        <span class="m-tooltip" x-text="content"></span>
        <span x-text="label"></span>
      </span>
    `,
    content,
    label,
  };
}
