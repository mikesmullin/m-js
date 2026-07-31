export default function Table(attrs = {}) {
  const {
    columns = [],
    rows = [],
    class: className = '',
  } = attrs;

  return {
    template: `
      <div class="m-table-wrap ${className}">
        <table class="m-table">
          <thead>
            <tr>
              <th x-for="col in columns" x-text="col.label || col.key"></th>
            </tr>
          </thead>
          <tbody>
            <tr x-for="row in rows">
              <td x-for="col in columns" x-text="cell(row, col)"></td>
            </tr>
            <tr x-show="rows.length === 0">
              <td :colspan="columns.length" class="text-center text-slate-500 py-8">
                No records
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    columns,
    rows,
    cell(row, col) {
      if (typeof col.format === 'function') return col.format(row[col.key], row);
      return row[col.key] ?? '';
    },
  };
}
