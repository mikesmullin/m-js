/**
 * DropDownMenu — logic lives mostly in the template (Alpine style)
 */
export default function DropDownMenu(attrs = {}) {
  const {
    label = 'Menu',
    labelIcon = '',
    color = 'secondary',
    disabled = false,
    class: className = '',
    options = [],
  } = attrs;

  return {
    // open/toggle/close expressed with x-data inline + thin methods for options
    template: `
      <div
        class="m-dropdown ${className}"
        x-data="{ open: false }"
        :class="{ open: open }"
        @focusout="setTimeout(() => { if (!$el.contains(document.activeElement)) open = false }, 0)"
      >
        <button
          type="button"
          class="m-btn m-btn-${color}"
          :disabled="disabled"
          @click="open = !open"
        >
          <i x-show="labelIcon" class="ph ${labelIcon ? 'ph-' + labelIcon : ''}"></i>
          <span x-text="label"></span>
          <i class="ph ph-caret-down" style="font-size:0.75em"></i>
        </button>
        <div class="m-dropdown-menu" role="menu" x-show="open" @click.outside="open = false">
          <button
            x-for="opt in options"
            type="button"
            class="m-dropdown-item"
            :class="{ danger: opt.danger }"
            :disabled="opt.disabled"
            @click="pick(opt, $event); open = false"
          >
            <i x-show="opt.icon" :class="'ph ph-' + (opt.icon || '')"></i>
            <span x-text="opt.label"></span>
          </button>
        </div>
      </div>
    `,
    label,
    labelIcon,
    disabled,
    options,
    pick(opt, e) {
      if (opt?.disabled) {
        e?.preventDefault();
        return;
      }
      if (typeof opt?.onclick === 'function') opt.onclick(e);
    },
  };
}
