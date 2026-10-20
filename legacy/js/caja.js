document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const app = document.getElementById('app');
  const isAdmin = AUTH.isAdmin();
  const CASH_METHODS = Logic.PAY_METHODS.filter(m => m.key !== 'paquete');
  let date = Util.today();
  let data = null;

  function load() {
    return DataService.all(['visits', 'packages', 'closings', 'pets', 'owners', 'groomers', 'expenses', 'lots', 'products']).then(d => { data = d; render(); });
  }

  /** Entradas y salidas del día por método de pago. Gastos y compras de insumos sin método se toman como efectivo. */
  function dayTotals() {
    const visits = data.visits.filter(v => v.date === date);
    const pkgs = data.packages.filter(p => p.purchasedAt === date);
    const expenses = data.expenses.filter(e => e.date === date);
    const lots = data.lots.filter(l => l.date === date);
    const inBy = {};
    const outBy = {};
    CASH_METHODS.forEach(m => { inBy[m.key] = 0; outBy[m.key] = 0; });
    visits.forEach(v => { if (inBy[v.payMethod] !== undefined) inBy[v.payMethod] += v.total + (v.tip || 0); });
    pkgs.forEach(p => { if (inBy[p.payMethod] !== undefined) inBy[p.payMethod] += p.price; });
    expenses.forEach(e => { outBy[e.payMethod || 'efectivo'] = (outBy[e.payMethod || 'efectivo'] || 0) + e.amount; });
    lots.forEach(l => { outBy[l.payMethod || 'efectivo'] = (outBy[l.payMethod || 'efectivo'] || 0) + l.cost; });
    const incomeAll = Util.sum(CASH_METHODS, m => inBy[m.key]);
    const outAll = Util.sum(CASH_METHODS, m => outBy[m.key]);
    return {
      visits, pkgs, expenses, lots, inBy, outBy,
      services: Util.sum(visits, v => v.total),
      packages: Util.sum(pkgs, p => p.price),
      tips: Util.sum(visits, v => v.tip),
      incomeAll, outAll, net: incomeAll - outAll
    };
  }

  /** Base inicial sugerida: el efectivo contado en el último cierre anterior a este día. */
  function suggestedBase() {
    const prev = data.closings.filter(c => c.date < date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return prev ? prev.cashCounted : 0;
  }

  function render() {
    const t = dayTotals();
    const closing = data.closings.find(c => c.date === date);
    const L = { pets: Util.byId(data.pets), owners: Util.byId(data.owners), groomers: Util.byId(data.groomers), products: Util.byId(data.products) };

    const rows = []
      .concat(t.visits.map(v => ({ time: v.time || '', cells: visitCells(v, L) })))
      .concat(t.pkgs.map(p => ({ time: '', cells: pkgCells(p, L) })))
      .concat(t.expenses.map(e => ({ time: '', cells: outCells('📉 Gasto: ' + e.category + (e.description ? ' — ' + e.description : ''), e.payMethod, e.amount, e.id) })))
      .concat(t.lots.map(l => ({ time: '', cells: outCells('🧴 Compra de insumo: ' + ((L.products[l.productId] || {}).name || ''), l.payMethod, l.cost, null) })))
      .sort((a, b) => (a.time < b.time ? -1 : 1));

    app.innerHTML =
      '<div class="action-buttons-row no-print">' +
        '<button class="btn btn-primary btn-feature" id="addVisitBtn">+ Registrar servicio</button>' +
        '<button class="btn btn-danger btn-feature" id="addExpBtn">+ Registrar gasto</button>' +
        '<button class="btn btn-secondary btn-feature" id="closeBtn">' + (closing ? '🧮 Revisar arqueo de caja' : '🧮 Arqueo y cierre de caja') + '</button>' +
      '</div>' +
      '<div class="date-range-bar">' +
        '<div class="field"><label for="dayPick">Día</label><input type="date" id="dayPick" value="' + date + '"></div>' +
        '<button class="btn btn-secondary" id="todayBtn">Hoy</button>' +
        (closing ? '<span class="chip green">Caja cerrada · ' + new Date(closing.closedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) + '</span>' : '<span class="chip amber">Caja abierta</span>') +
      '</div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card stat-neutral"><span>Servicios del día</span><strong>' + t.visits.length + '</strong></div>' +
        '<div class="stat-card stat-venta"><span>Total recaudado</span><strong>' + UI.formatCurrency(t.incomeAll) + '</strong><small>Servicios + paquetes + propinas</small></div>' +
        '<div class="stat-card stat-gasto"><span>Gastos y compras</span><strong>' + UI.formatCurrency(t.outAll) + '</strong></div>' +
        '<div class="stat-card stat-balance"><span>Neto del día</span><strong>' + UI.formatCurrency(t.net) + '</strong><small>Incluye propinas ' + UI.formatCurrency(t.tips) + '</small></div>' +
      '</div>' +
      '<div class="method-grid">' + CASH_METHODS.map(m =>
        '<div class="method-card"><span>' + m.label + '</span><strong>' + UI.formatCurrency(t.inBy[m.key] - t.outBy[m.key]) + '</strong>' +
        '<span>Entró ' + UI.formatCurrency(t.inBy[m.key]) + ' · salió ' + UI.formatCurrency(t.outBy[m.key]) + '</span></div>').join('') + '</div>' +
      (rows.length ? UI.table(['Hora', 'Detalle', 'Mascota', 'Groomer', 'Pago', 'Monto', 'Propina', 'Acciones'], rows.map(r => ({ cells: r.cells }))) : UI.emptyState('🧾', 'No hay movimientos registrados este día.')) +
      (isAdmin ? closingsHistory() : '');

    wire(t, closing);
  }

  function visitCells(v, L) {
    const pet = L.pets[v.petId] || {};
    const owner = L.owners[v.ownerId] || {};
    return [
      v.time ? Util.formatTime(v.time) : '—',
      UI.escapeHtml(v.items.map(i => i.name).join(', ')) + (v.discountKey ? ' <span class="chip amber">-' + v.discountPct + '%</span>' : '') + (v.usedPackage ? ' <span class="chip blue">paquete</span>' : ''),
      '<strong>' + UI.escapeHtml(pet.name || '—') + '</strong><div class="muted" style="font-size:.75rem">' + UI.escapeHtml(owner.name || '') + '</div>',
      UI.escapeHtml((L.groomers[v.groomerId] || {}).name || '—'),
      Logic.payLabel(v.payMethod),
      '<strong>' + UI.formatCurrency(v.total) + '</strong>',
      v.tip ? UI.formatCurrency(v.tip) : '—',
      isAdmin ? '<button class="btn btn-secondary btn-sm" data-delvisit="' + v.id + '">🗑️</button>' : '<span class="muted">—</span>'
    ];
  }

  function pkgCells(p, L) {
    const pet = L.pets[p.petId] || {};
    return ['—', '📦 ' + UI.escapeHtml(p.name), UI.escapeHtml(pet.name || '—'), '—', Logic.payLabel(p.payMethod), '<strong>' + UI.formatCurrency(p.price) + '</strong>', '—', '<span class="muted">—</span>'];
  }

  function outCells(text, method, amount, expenseId) {
    return ['—', UI.escapeHtml(text), '—', '—', Logic.payLabel(method || 'efectivo'),
      '<span class="amount-cell gasto">- ' + UI.formatCurrency(amount) + '</span>', '—',
      isAdmin && expenseId ? '<button class="btn btn-secondary btn-sm" data-delexp="' + expenseId + '">🗑️</button>' : '<span class="muted">—</span>'];
  }

  function closingsHistory() {
    const list = data.closings.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
    if (!list.length) return '';
    return '<div class="section-title"><h2>Arqueos recientes</h2></div>' +
      UI.table(['Fecha', 'Recaudado', 'Gastos', 'Efectivo esperado', 'Efectivo contado', 'Diferencia', 'Cerró'], list.map(c => ({
        cells: [Util.formatShort(c.date), UI.formatCurrency(c.totalAll), UI.formatCurrency(c.expensesTotal || 0), UI.formatCurrency(c.expectedCash), UI.formatCurrency(c.cashCounted),
          '<span class="chip ' + (c.difference === 0 ? 'green' : 'red') + '">' + (c.difference > 0 ? '+' : '') + UI.formatCurrency(c.difference) + '</span>', UI.escapeHtml(c.closedBy || '')]
      })));
  }

  function wire(t, closing) {
    document.getElementById('addVisitBtn').addEventListener('click', () => VisitForm.open({ date, onSaved: load }));
    document.getElementById('addExpBtn').addEventListener('click', () => ExpenseForm.open(null, load, { date }));
    document.getElementById('closeBtn').addEventListener('click', () => arqueoModal(t, closing));
    document.getElementById('todayBtn').addEventListener('click', () => { date = Util.today(); render(); });
    document.getElementById('dayPick').addEventListener('change', e => { if (e.target.value) { date = e.target.value; render(); } });

    app.querySelectorAll('[data-delexp]').forEach(b => b.addEventListener('click', () => {
      if (confirm('¿Eliminar este gasto?')) DataService.expenses.remove(b.getAttribute('data-delexp')).then(() => { UI.showToast('Gasto eliminado', 'success'); load(); });
    }));
    app.querySelectorAll('[data-delvisit]').forEach(b => b.addEventListener('click', () => {
      const v = data.visits.find(x => x.id === b.getAttribute('data-delvisit'));
      if (!confirm('¿Eliminar este servicio de la caja? Si usó paquete o venía de una cita, se revierte.')) return;
      const jobs = [DataService.visits.remove(v.id)];
      if (v.usedPackage && v.packageId) {
        const pkg = data.packages.find(p => p.id === v.packageId);
        if (pkg) jobs.push(DataService.packages.update(pkg.id, { remaining: pkg.remaining + 1 }));
      }
      if (v.appointmentId) {
        jobs.push(DataService.appointments.get(v.appointmentId).then(a => a ? DataService.appointments.update(a.id, { status: 'agendada', visitId: null }) : null));
      }
      Promise.all(jobs).then(() => { UI.logAction('Servicio eliminado de caja', UI.formatCurrency(v.total)); UI.showToast('Servicio eliminado', 'success'); load(); });
    }));
  }

  /** Arqueo: efectivo esperado = base + efectivo recibido − gastos en efectivo − retiros; se compara con lo contado. */
  function arqueoModal(t, closing) {
    const cashIn = t.inBy.efectivo;
    const cashOut = t.outBy.efectivo;
    const base = closing ? closing.base : suggestedBase();
    const retiros = closing ? closing.retiros || 0 : 0;
    const row = (label, value, extra) => '<div class="row"><span>' + label + '</span><span' + (extra ? ' style="' + extra + '"' : '') + '>' + value + '</span></div>';

    UI.openModal(
      '<h2>🧮 Arqueo de caja</h2><p class="modal-subtitle">' + Util.formatLong(date) + '</p>' +
      '<div class="total-box" style="margin-top:0">' +
        '<strong>Ingresos</strong>' + CASH_METHODS.map(m => row(m.label, UI.formatCurrency(t.inBy[m.key]))).join('') +
        row('<strong>Total recaudado</strong>', '<strong>' + UI.formatCurrency(t.incomeAll) + '</strong>') +
        '<strong style="display:block;margin-top:8px">Gastos y compras</strong>' +
        (t.outAll ? CASH_METHODS.filter(m => t.outBy[m.key]).map(m => row(m.label, '- ' + UI.formatCurrency(t.outBy[m.key]))).join('') : row('Sin gastos', '—')) +
        row('<strong>Neto del día</strong>', '<strong>' + UI.formatCurrency(t.net) + '</strong>') +
      '</div>' +
      '<form id="closeForm" style="margin-top:14px">' +
        '<div class="form-grid-2">' +
          '<div class="field"><label for="cf_base">Base inicial en caja</label><input type="number" id="cf_base" min="0" value="' + base + '"><div class="field-hint">Efectivo con el que abrió la caja.</div></div>' +
          '<div class="field"><label for="cf_ret">Retiros / consignaciones</label><input type="number" id="cf_ret" min="0" value="' + retiros + '"><div class="field-hint">Efectivo sacado de la caja (propinas pagadas, consignación...).</div></div>' +
        '</div>' +
        '<div class="total-box" style="margin:0 0 14px">' +
          row('Base inicial', '<span id="cf_r_base"></span>') +
          row('+ Efectivo recibido (con propinas)', UI.formatCurrency(cashIn)) +
          row('− Gastos pagados en efectivo', UI.formatCurrency(cashOut)) +
          row('− Retiros', '<span id="cf_r_ret"></span>') +
          '<div class="row total"><span>Efectivo esperado en caja</span><span id="cf_expected"></span></div>' +
        '</div>' +
        '<div class="field"><label for="cf_cash">Efectivo contado</label><input type="number" id="cf_cash" min="0" value="' + (closing ? closing.cashCounted : '') + '" placeholder="Cuenta el efectivo e ingrésalo"></div>' +
        '<div class="total-box" id="cf_diff" style="margin:0 0 14px"></div>' +
        '<div class="field"><label for="cf_notes">Notas</label><textarea id="cf_notes">' + UI.escapeHtml(closing ? closing.notes || '' : '') + '</textarea></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="cf_cancel">Cancelar</button><button type="submit" class="btn btn-primary">' + (closing ? 'Actualizar arqueo' : 'Cerrar caja') + '</button></div>' +
      '</form>',
      { wide: true }
    );

    const $ = id => document.getElementById(id);
    const num = id => Number($(id).value) || 0;
    const expected = () => num('cf_base') + cashIn - cashOut - num('cf_ret');
    function update() {
      $('cf_r_base').textContent = UI.formatCurrency(num('cf_base'));
      $('cf_r_ret').textContent = UI.formatCurrency(num('cf_ret'));
      $('cf_expected').textContent = UI.formatCurrency(expected());
      if ($('cf_cash').value === '') { $('cf_diff').innerHTML = '<div class="field-hint">Ingresa el efectivo contado para ver la diferencia.</div>'; return; }
      const diff = num('cf_cash') - expected();
      $('cf_diff').innerHTML = '<div class="row total"><span>Diferencia</span><span>' + (diff > 0 ? '+' : '') + UI.formatCurrency(diff) + '</span></div>' +
        '<div class="field-hint">' + (diff === 0 ? '✔ La caja cuadra.' : diff > 0 ? 'Sobra dinero en caja.' : 'Falta dinero en caja.') + '</div>';
    }
    update();
    ['cf_base', 'cf_ret', 'cf_cash'].forEach(id => $(id).addEventListener('input', update));
    $('cf_cancel').addEventListener('click', UI.closeModal);
    $('closeForm').addEventListener('submit', e => {
      e.preventDefault();
      if ($('cf_cash').value === '') { UI.showToast('Ingresa el efectivo contado', 'danger'); return; }
      const session = AUTH.getSession();
      const payload = {
        date, base: num('cf_base'), retiros: num('cf_ret'), cashIn, cashOut, expectedCash: expected(), cashCounted: num('cf_cash'),
        difference: num('cf_cash') - expected(), totalAll: t.incomeAll, expensesTotal: t.outAll, net: t.net,
        notes: $('cf_notes').value.trim(), closedBy: session ? session.user : '', closedAt: Date.now()
      };
      const job = closing ? DataService.closings.update(closing.id, payload) : DataService.closings.add(payload);
      job.then(() => {
        UI.logAction('Caja cerrada', Util.formatShort(date) + ' — recaudado ' + UI.formatCurrency(t.incomeAll) + ', gastos ' + UI.formatCurrency(t.outAll));
        UI.showToast('Arqueo guardado', 'success');
        UI.closeModal();
        load();
      });
    });
  }

  load();
});
