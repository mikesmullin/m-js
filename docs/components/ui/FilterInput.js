export default function FilterInput(attrs = {}) {
  const {
    value = '',
    placeholder = 'Filter…',
    matchedCount = 0,
    onsearch = null,
    class: className = '',
  } = attrs;

  return {
    template: `
      <div class="flex items-center gap-3 ${className}">
        <div class="relative flex-1">
          <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input
            type="search"
            class="m-input pl-9"
            placeholder="${placeholder}"
            x-model="value"
            @input="onsearch?.(value)"
          />
        </div>
        <span class="m-badge m-badge-primary whitespace-nowrap">
          <span x-text="matchedCount"></span>
          <span class="opacity-70">matches</span>
        </span>
      </div>
    `,
    value,
    matchedCount,
    onsearch,
  };
}
