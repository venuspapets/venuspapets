document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAdmin();

  const app = document.getElementById('app');
  let from = Util.startOfMonth(Util.today());
  let to = Util.today();
  let data = null;

  function load() {
    return DataService.all(['visits', 'packages', 'lots', 'expenses']).then(d => { data = d; render(); });
  }

  function render() {
    const f = Logic.financials(data, from, to);
    const byCat = {};
    f.expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const maxCat = Math.max(1, ...Object.keys(byCat).map(k => byCat[k]));

    app.innerHTML =
      '<div class="action-buttons-row"><button class="btn btn-danger btn-feature" id="addExpBtn">+ Registrar gasto</button></div>' +
      '<div class="date-range-bar">' +
        '<div class="field"><label for="fromD">Desde</label><input type="date" id="fromD" value="' + from + '"></div>' +
        '<div class="field"><label for="toD">Hasta</label><input type="date" id="toD" value="' + to + '"></div>' +
        '<button class="btn btn-primary" id="goBtn">Consultar</button>' +
        '<button class="btn btn-secondary" id="monthBtn">Este mes</button>' +
        '<button class="btn btn-secondary" id="prevMonthBtn">Mes anterior</button>' +
      '</div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card stat-venta"><span>Ingresos</span><strong>' + UI.formatCurrency(f.income) + '</strong><small>Servicios + paquetes (sin propinas)</small></div>' +
        '<div class="stat-card stat-gasto"><span>Insumos comprados</span><strong>' + UI.formatCurrency(f.supplies) + '</strong></div>' +
        '<div class="stat-card stat-gasto"><span>Gastos del negocio</span><strong>' + UI.formatCurrency(f.otherExpenses) + '</strong></div>' +
        '<div class="stat-card stat-balance"><span>Utilidad real</span><strong style="color:' + (f.profit < 0 ? 'var(--color-danger)' : 'var(--color-success)') + '">' + UI.formatCurrency(f.profit) + '</strong><small>Ingresos − insumos − gastos</small></div>' +
      '</div>' +
      (Object.keys(byCat).length ? '<div class="section-title" style="margin-top:0"><h2>Gastos por categoría</h2></div>' +
        UI.table(['Categoría', 'Total', ''], Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map(k => ({
          cells: [UI.escapeHtml(k), '<strong>' + UI.formatCurrency(byCat[k]) + '</strong>', '<div class="progress"><div style="width:' + Math.round(byCat[k] / maxCat * 100) + '%"></div></div>']
        })), { numCols: [1] }) : '') +
      '<div class="section-title"><h2>Detalle de gastos</h2></div>' +
      (f.expenses.length ? UI.table(['Fecha', 'Categoría', 'Descripción', 'Pago', 'Monto', 'Acciones'],
        f.expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(e => ({
          cells: [Util.formatShort(e.date), '<span class="chip">' + UI.escapeHtml(e.category) + '</span>', '<span class="desc-cell">' + UI.escapeHtml(e.description || '—') + '</span>', Logic.payLabel(e.payMethod || 'efectivo'),
            '<span class="amount-cell gasto">- ' + UI.formatCurrency(e.amount) + '</span>',
            '<div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit="' + e.id + '">✏️</button><button class="btn btn-secondary btn-sm" data-del="' + e.id + '">🗑️</button></div>']
        })), { numCols: [4] }) : UI.emptyState('📉', 'No hay gastos en este rango de fechas.'));

    const $ = id => document.getElementById(id);
    $('addExpBtn').addEventListener('click', () => ExpenseForm.open(null, load));
    $('goBtn').addEventListener('click', () => { from = $('fromD').value || from; to = $('toD').value || to; render(); });
    $('monthBtn').addEventListener('click', () => { from = Util.startOfMonth(Util.today()); to = Util.today(); render(); });
    $('prevMonthBtn').addEventListener('click', () => {
      const prev = Util.addDays(Util.startOfMonth(Util.today()), -1);
      from = Util.startOfMonth(prev); to = prev; render();
    });
    app.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => ExpenseForm.open(b.getAttribute('data-edit'), load)));
    app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      if (confirm('¿Eliminar este gasto?')) DataService.expenses.remove(b.getAttribute('data-del')).then(() => { UI.showToast('Gasto eliminado', 'success'); load(); });
    }));
  }

  load();
});
