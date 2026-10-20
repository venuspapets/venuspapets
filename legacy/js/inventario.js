document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const app = document.getElementById('app');
  const isAdmin = AUTH.isAdmin();
  let data = null;

  function load() {
    return DataService.all(['products', 'lots', 'visits']).then(d => { data = d; render(); });
  }

  /** Una "compra" se guarda como un lote por unidad (frasco, galón...), así se mide cuánto dura cada uno. */
  function stockOf(productId) { return data.lots.filter(l => l.productId === productId && !l.finishedDate).length; }

  function render() {
    const today = Util.today();
    const monthStart = Util.startOfMonth(today);
    const prods = Util.byId(data.products);

    const low = data.products.filter(p => stockOf(p.id) <= p.minStock);
    const monthLots = data.lots.filter(l => l.date >= monthStart);
    const last30 = Util.addDays(today, -30);
    const finished30 = data.lots.filter(l => l.finishedDate && l.finishedDate >= last30);
    const services30 = data.visits.filter(v => v.date >= last30).length;
    const costPerService = services30 ? Math.round(Util.sum(finished30, l => l.cost) / services30) : 0;

    app.innerHTML =
      (low.length ? '<div class="alert-box warn">⚠️ <strong>Stock bajo:</strong> ' + low.map(p => UI.escapeHtml(p.name) + ' (' + stockOf(p.id) + ')').join(' · ') + '</div>' : '') +
      '<div class="action-buttons-row">' +
        '<button class="btn btn-primary btn-feature" id="buyBtn">+ Registrar compra</button>' +
        '<button class="btn btn-secondary btn-feature" id="newProdBtn">+ Nuevo producto</button>' +
      '</div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card stat-gasto"><span>Compras del mes</span><strong>' + UI.formatCurrency(Util.sum(monthLots, l => l.cost)) + '</strong></div>' +
        '<div class="stat-card stat-balance"><span>Costo de insumos por servicio</span><strong>' + UI.formatCurrency(costPerService) + '</strong><small>Insumos terminados (30 días) ÷ servicios</small></div>' +
        '<div class="stat-card stat-warn"><span>Productos con stock bajo</span><strong>' + low.length + '</strong></div>' +
      '</div>' +

      '<div class="section-title"><h2>Productos</h2></div>' +
      (data.products.length ? UI.table(['Producto', 'En stock', 'Mínimo', 'Duración promedio', 'Costo promedio', 'Acciones'], data.products.map(p => {
        const done = data.lots.filter(l => l.productId === p.id && l.finishedDate);
        const avgDays = done.length ? Math.round(Util.sum(done, l => Util.diffDays(l.date, l.finishedDate)) / done.length) : null;
        const avgCost = done.length ? Math.round(Util.sum(done, l => l.cost) / done.length) : null;
        const stock = stockOf(p.id);
        return { cells: [
          '<strong>' + UI.escapeHtml(p.name) + '</strong><div class="muted" style="font-size:.75rem">' + UI.escapeHtml(p.unit || '') + '</div>',
          '<span class="chip ' + (stock <= p.minStock ? 'red' : 'green') + '">' + stock + '</span>',
          String(p.minStock),
          avgDays !== null ? avgDays + ' días' : '<span class="muted">—</span>',
          avgCost !== null ? UI.formatCurrency(avgCost) : '<span class="muted">—</span>',
          '<div class="row-actions"><button class="btn btn-secondary btn-sm" data-editprod="' + p.id + '">✏️</button>' +
          (isAdmin ? '<button class="btn btn-secondary btn-sm" data-delprod="' + p.id + '">🗑️</button>' : '') + '</div>'
        ] };
      })) : UI.emptyState('🧴', 'Aún no hay productos.')) +

      '<div class="section-title"><h2>Compras y unidades en uso</h2></div>' +
      (data.lots.length ? UI.table(['Comprado', 'Producto', 'Proveedor', 'Costo', 'Estado', 'Acciones'],
        data.lots.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 60).map(l => {
          const p = prods[l.productId] || { name: '—' };
          const days = l.finishedDate ? Util.diffDays(l.date, l.finishedDate) : Util.diffDays(l.date, today);
          return { cells: [
            Util.formatShort(l.date), UI.escapeHtml(p.name), UI.escapeHtml(l.supplier || '—'), UI.formatCurrency(l.cost),
            l.finishedDate
              ? '<span class="chip gray">Terminado</span><div class="muted" style="font-size:.75rem">duró ' + days + ' d · ' + UI.formatCurrency(Math.round(l.cost / Math.max(1, days))) + '/día</div>'
              : '<span class="chip green">En stock / en uso</span><div class="muted" style="font-size:.75rem">hace ' + days + ' d</div>',
            l.finishedDate ? '<button class="btn btn-secondary btn-sm" data-reopen="' + l.id + '">Reabrir</button>'
              : '<button class="btn btn-primary btn-sm" data-finish="' + l.id + '">Marcar terminado</button>'
          ] };
        })) : UI.emptyState('🧾', 'Aún no hay compras registradas.'));

    document.getElementById('buyBtn').addEventListener('click', buyForm);
    document.getElementById('newProdBtn').addEventListener('click', () => productForm(null));
    app.querySelectorAll('[data-editprod]').forEach(b => b.addEventListener('click', () => productForm(b.getAttribute('data-editprod'))));
    app.querySelectorAll('[data-delprod]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-delprod');
      if (data.lots.some(l => l.productId === id)) { UI.showToast('Este producto tiene compras registradas y no se puede eliminar', 'danger'); return; }
      if (confirm('¿Eliminar este producto?')) DataService.products.remove(id).then(load);
    }));
    app.querySelectorAll('[data-finish]').forEach(b => b.addEventListener('click', () => {
      const l = data.lots.find(x => x.id === b.getAttribute('data-finish'));
      DataService.lots.update(l.id, { finishedDate: Util.today() }).then(() => {
        UI.logAction('Insumo terminado', (prods[l.productId] || {}).name || '');
        UI.showToast('Marcado como terminado', 'success');
        load();
      });
    }));
    app.querySelectorAll('[data-reopen]').forEach(b => b.addEventListener('click', () => DataService.lots.update(b.getAttribute('data-reopen'), { finishedDate: null }).then(load)));
  }

  function productForm(id) {
    const p = id ? data.products.find(x => x.id === id) : { name: '', unit: '', minStock: 1 };
    UI.openModal(
      '<h2>' + (id ? '✏️ Editar producto' : '🧴 Nuevo producto') + '</h2>' +
      '<form id="prodForm">' +
        '<div class="field"><label for="pr_name">Nombre</label><input id="pr_name" required value="' + UI.escapeHtml(p.name) + '" placeholder="Champú hipoalergénico"></div>' +
        '<div class="form-grid-2"><div class="field"><label for="pr_unit">Unidad</label><input id="pr_unit" value="' + UI.escapeHtml(p.unit || '') + '" placeholder="galón, frasco..."></div>' +
        '<div class="field"><label for="pr_min">Alertar cuando queden</label><input type="number" id="pr_min" min="0" value="' + p.minStock + '"></div></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="pr_cancel">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>' +
      '</form>'
    );
    document.getElementById('pr_cancel').addEventListener('click', UI.closeModal);
    document.getElementById('prodForm').addEventListener('submit', e => {
      e.preventDefault();
      const payload = { name: document.getElementById('pr_name').value.trim(), unit: document.getElementById('pr_unit').value.trim(), minStock: Number(document.getElementById('pr_min').value) || 0 };
      (id ? DataService.products.update(id, payload) : DataService.products.add(payload)).then(() => { UI.showToast('Producto guardado', 'success'); UI.closeModal(); load(); });
    });
  }

  function buyForm() {
    if (!data.products.length) { UI.showToast('Primero crea un producto', 'danger'); return; }
    UI.openModal(
      '<h2>🧾 Registrar compra</h2>' +
      '<form id="buyForm">' +
        '<div class="field"><label for="by_prod">Producto</label><select id="by_prod">' + data.products.map(p => '<option value="' + p.id + '">' + UI.escapeHtml(p.name) + '</option>').join('') + '</select></div>' +
        '<div class="form-grid-2"><div class="field"><label for="by_qty">Cantidad de unidades</label><input type="number" id="by_qty" min="1" value="1"></div>' +
        '<div class="field"><label for="by_cost">Costo total</label><input type="number" id="by_cost" min="0" value="0"></div></div>' +
        '<div class="form-grid-2"><div class="field"><label for="by_supplier">Proveedor</label><input id="by_supplier"></div>' +
        '<div class="field"><label for="by_date">Fecha</label><input type="date" id="by_date" value="' + Util.today() + '"></div></div>' +
        '<div class="field"><label for="by_pay">Se pagó con</label><select id="by_pay">' + Logic.PAY_METHODS.filter(m => m.key !== 'paquete').map(m => '<option value="' + m.key + '">' + m.label + '</option>').join('') + '</select></div>' +
        '<div class="field-hint">Cada unidad queda como un frasco/galón independiente: al terminarlo lo marcas y la app calcula cuánto duró y cuánto costó.</div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="by_cancel">Cancelar</button><button class="btn btn-primary" type="submit">Guardar compra</button></div>' +
      '</form>'
    );
    UI.enhanceSelect(document.getElementById('by_prod'));
    document.getElementById('by_cancel').addEventListener('click', UI.closeModal);
    document.getElementById('buyForm').addEventListener('submit', e => {
      e.preventDefault();
      const $ = id => document.getElementById(id);
      const qty = Math.max(1, Number($('by_qty').value) || 1);
      const unitCost = Math.round((Number($('by_cost').value) || 0) / qty);
      const jobs = [];
      for (let i = 0; i < qty; i++) {
        jobs.push(DataService.lots.add({ productId: $('by_prod').value, date: $('by_date').value, cost: unitCost, supplier: $('by_supplier').value.trim(), payMethod: $('by_pay').value, finishedDate: null }));
      }
      Promise.all(jobs).then(() => {
        UI.logAction('Compra de insumos', qty + ' unidad(es) — ' + UI.formatCurrency(Number($('by_cost').value) || 0));
        UI.showToast('Compra registrada', 'success');
        UI.closeModal();
        load();
      });
    });
  }

  load();
});
