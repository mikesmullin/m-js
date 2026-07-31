export default function TextInput(attrs = {}) {
  const {
    type = 'text',
    id = '',
    name = '',
    label = '',
    value = '',
    placeholder = '',
    description = '',
    invalid = '',
    disabled = false,
    readonly = false,
    class: className = '',
    oninput = null,
  } = attrs;

  const inputId = id || name || 'input-' + Math.random().toString(36).slice(2, 8);

  return {
    template: `
      <div class="m-form-group">
        <label
          x-show="label"
          class="m-label"
          :class="{ 'is-invalid': !!invalid }"
          for="${inputId}"
          x-text="label"
        ></label>
        <input
          id="${inputId}"
          name="${name}"
          type="${type}"
          class="m-input ${className}"
          :class="{ 'is-invalid': !!invalid }"
          placeholder="${placeholder}"
          x-model="value"
          :disabled="disabled"
          :readonly="readonly"
          @input="onInput"
          autocomplete="off"
          spellcheck="false"
        />
        <div x-show="invalid" class="m-error">
          <i class="ph ph-warning-circle"></i>
          <span x-text="invalid"></span>
        </div>
        <div x-show="description && !invalid" class="m-help" x-text="description"></div>
      </div>
    `,
    label,
    value,
    invalid,
    description,
    disabled,
    readonly,
    onInput(e) {
      if (typeof oninput === 'function') oninput.call(this, e);
    },
  };
}
