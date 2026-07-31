export default function RefreshButton(attrs = {}) {
  const { onrefresh = null, class: className = '' } = attrs;

  return {
    template: `
      <button
        type="button"
        class="m-btn m-btn-secondary ${className}"
        :disabled="loading"
        @click="refresh"
        title="Reload data"
      >
        <i class="ph" :class="iconClass" :style="loading ? 'animation: spin 1s linear infinite' : ''"></i>
        <span x-text="label"></span>
      </button>
    `,
    loading: false,
    state: 'rdy',
    get label() {
      return { rdy: 'Refresh', load: 'Loading…', ok: 'Done', fail: 'Failed' }[this.state];
    },
    get iconClass() {
      return {
        rdy: 'ph-arrows-clockwise',
        load: 'ph-spinner-gap',
        ok: 'ph-check',
        fail: 'ph-skull',
      }[this.state];
    },
    async refresh() {
      if (this.loading) return;
      this.loading = true;
      this.state = 'load';
      try {
        if (typeof onrefresh === 'function') await onrefresh(false);
        this.state = 'ok';
      } catch {
        this.state = 'fail';
      } finally {
        this.loading = false;
        setTimeout(() => {
          if (this.state === 'ok' || this.state === 'fail') this.state = 'rdy';
        }, 1500);
      }
    },
  };
}
