export default function FormGroup(attrs = {}) {
  const {
    label = '',
    invalid = '',
    description = '',
    id = '',
    class: className = '',
    body = '',
  } = attrs;

  return {
    template: `
      <div class="m-form-group ${className}">
        <label
          x-show="label"
          class="m-label"
          :class="{ 'is-invalid': !!invalid }"
          ${id ? `for="${id}"` : ''}
          x-text="label"
        ></label>
        <div x-html="body"></div>
        <div x-show="invalid" class="m-error" x-text="invalid"></div>
        <div x-show="description && !invalid" class="m-help" x-text="description"></div>
      </div>
    `,
    label,
    invalid,
    description,
    body,
  };
}
