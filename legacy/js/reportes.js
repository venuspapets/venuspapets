document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAdmin();

  const app = document.getElementById('app');
  const today = Util.today();
  let from = today;
  let to = today;
  let data = null;
  let settings = null;
  let sections = [];

  function load() {
    return Promise.all([DataService.all(['visits', 'packages', 'lots', 'expenses', 'pets', 'owners', 'groomers', 'products']), DataService.getSettings()])
      .then(r => { data = r[0]; settings = r[1]; render(); });
  }

  function agg(list, keyFn, valueFns) {
    const map = {};
    list.forEach(x => {
      const k = keyFn(x);
      map[k] = map[k] || { key: k, n: 0, a: 0, b: 0 };
      map[k].n++;
      map[k].a += valueFns[0](x);
      map[k].b += valueFns[1] ? valueFns[1](x) : 0;
    });
    return Object.keys(map).map(k => map[k]);
  }

  function build() {
    const f = Logic.financials(data, from, to);
    const pets = Util.byId(data.pets);
    const owners = Util.byId(data.owners);
    const groomers = Util.byId(data.groomers);
    const products = Util.byId(data.products);
    const $ = UI.formatCurrency;
    const out = [];

    out.push({ title: 'Resumen del período', headers: ['Concepto', 'Valor'], numCols: [1], rows: [
      ['Servicios realizados', String(f.count)],
      ['Ingresos por servicios', $(f.incomeServices)],
      ['Ingresos por paquetes prepagados', $(f.incomePackages)],
      ['Total ingresos', $(f.income)],
      ['Ticket promedio por servicio', $(f.avgTicket)],
      ['Insumos comprados', $(f.supplies)],
      ['Gastos del negocio', $(f.otherExpenses)],
      ['UTILIDAD REAL (ingresos − insumos − gastos)', $(f.profit)],
      ['Propinas recibidas (no incluidas en ingresos)', $(f.tips)]
    ] });

    // Por servicio: el descuento se reparte proporcionalmente entre los servicios de la visita.
    const lines = [];
    f.visits.forEach(v => {
      const ratio = v.subtotal > 0 ? v.total / v.subtotal : 0;
      v.items.forEach(i => lines.push({ name: i.name, net: i.price * ratio }));
    });
    out.push({ title: 'Por servicio', headers: ['Servicio', 'Veces', 'Ingresos'], numCols: [1, 2],
      rows: agg(lines, l => l.name, [l => l.net]).sort((x, y) => y.a - x.a).map(r => [r.key, String(r.n), $(Math.round(r.a))]) });

    out.push({ title: 'Por groomer', headers: ['Groomer', 'Servicios', 'Ingresos', 'Propinas', 'Comisión %', 'Comisión $'], numCols: [1, 2, 3, 4, 5],
      rows: agg(f.visits, v => v.groomerId, [v => v.total, v => v.tip]).sort((x, y) => y.a - x.a).map(r => {
        const g = groomers[r.key] || { name: 'Sin asignar', commission: 0 };
        return [g.name, String(r.n), $(r.a), $(r.b), g.commission + '%', $(Math.round(r.a * g.commission / 100))];
      }) });

    const methodRows = {};
    Logic.PAY_METHODS.forEach(m => { methodRows[m.key] = { n: 0, income: 0, tips: 0 }; });
    f.visits.forEach(v => { const r = methodRows[v.payMethod] || (methodRows[v.payMethod] = { n: 0, income: 0, tips: 0 }); r.n++; r.income += v.total; r.tips += v.tip || 0; });
    f.pkgSales.forEach(p => { const r = methodRows[p.payMethod] || (methodRows[p.payMethod] = { n: 0, income: 0, tips: 0 }); r.n++; r.income += p.price; });
    out.push({ title: 'Por método de pago (servicios y paquetes)', headers: ['Método', 'Transacciones', 'Ingresos', 'Propinas'], numCols: [1, 2, 3],
      rows: Object.keys(methodRows).filter(k => methodRows[k].n).map(k => [Logic.payLabel(k), String(methodRows[k].n), $(methodRows[k].income), $(methodRows[k].tips)]) });

    out.push({ title: 'Por raza', headers: ['Raza', 'Servicios', 'Ingresos'], numCols: [1, 2],
      rows: agg(f.visits, v => (pets[v.petId] && pets[v.petId].breed) || 'Sin raza', [v => v.total]).sort((x, y) => y.a - x.a).map(r => [r.key, String(r.n), $(r.a)]) });

    out.push({ title: 'Mejores clientes del período', headers: ['Cliente', 'Visitas', 'Total gastado'], numCols: [1, 2],
      rows: agg(f.visits, v => v.ownerId, [v => v.total]).sort((x, y) => y.a - x.a).slice(0, 10).map(r => [(owners[r.key] || { name: '—' }).name, String(r.n), $(r.a)]) });

    const inactive = [];
    data.owners.forEach(o => {
      const last = Logic.lastVisitOfOwner(data.visits, o.id);
      if (last) {
        const days = Util.diffDays(last, today);
        if (days >= settings.inactiveDays[0]) inactive.push([o.name, Util.formatPhone(o.whatsapp), Util.formatShort(last), String(days), days]);
      }
    });
    out.push({ title: 'Clientes inactivos (hoy, ' + settings.inactiveDays[0] + '+ días sin venir)', headers: ['Cliente', 'WhatsApp', 'Última visita', 'Días'], numCols: [3],
      rows: inactive.sort((x, y) => y[4] - x[4]).map(r => r.slice(0, 4)) });

    out.push({ title: 'Productos más gastados (compras del período)', headers: ['Producto', 'Unidades', 'Costo'], numCols: [1, 2],
      rows: agg(f.lots, l => l.productId, [l => l.cost]).sort((x, y) => y.a - x.a).map(r => [(products[r.key] || { name: '—' }).name, String(r.n), $(r.a)]) });

    return out;
  }

  function render() {
    sections = build();
    app.innerHTML =
      '<div class="date-range-bar no-print">' +
        '<div class="field"><label for="fromD">Desde</label><input type="date" id="fromD" value="' + from + '"></div>' +
        '<div class="field"><label for="toD">Hasta</label><input type="date" id="toD" value="' + to + '"></div>' +
        '<button class="btn btn-primary" id="goBtn">Consultar</button>' +
        '<button class="btn btn-secondary" data-preset="day">Hoy</button>' +
        '<button class="btn btn-secondary" data-preset="week">Esta semana</button>' +
        '<button class="btn btn-secondary" data-preset="month">Este mes</button>' +
        '<button class="btn btn-secondary" data-preset="prev">Mes anterior</button>' +
      '</div>' +
      '<div class="action-buttons-row no-print">' +
        '<button class="btn btn-success" id="xlsBtn">📗 Exportar a Excel</button>' +
        '<button class="btn btn-secondary" id="pdfBtn">📄 Exportar a PDF</button>' +
      '</div>' +
      '<div class="print-only"><h2>' + settings.businessName + ' — Reporte del ' + Util.formatShort(from) + ' al ' + Util.formatShort(to) + '</h2></div>' +
      sections.map(s => '<div class="report-block"><h2>' + UI.escapeHtml(s.title) + '</h2>' +
        (s.rows.length ? UI.table(s.headers.map(UI.escapeHtml), s.rows.map(r => ({ cells: r.map(UI.escapeHtml) })), { numCols: s.numCols })
          : '<p class="muted">Sin datos en este período.</p>') + '</div>').join('');

    const $ = id => document.getElementById(id);
    $('goBtn').addEventListener('click', () => { from = $('fromD').value || from; to = $('toD').value || to; render(); });
    app.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const p = b.getAttribute('data-preset');
      if (p === 'day') { from = today; to = today; }
      if (p === 'week') { from = Util.startOfWeek(today); to = Util.addDays(from, 6); }
      if (p === 'month') { from = Util.startOfMonth(today); to = Util.endOfMonth(today); }
      if (p === 'prev') { const last = Util.addDays(Util.startOfMonth(today), -1); from = Util.startOfMonth(last); to = last; }
      render();
    }));
    $('xlsBtn').addEventListener('click', () => {
      UI.downloadExcel('reporte-venuspa-' + from + '_' + to + '.xls', sections.map(s => ({ title: s.title, headers: s.headers, rows: s.rows })));
      UI.logAction('Reporte exportado', 'Excel ' + from + ' a ' + to);
    });
    $('pdfBtn').addEventListener('click', () => { UI.logAction('Reporte exportado', 'PDF ' + from + ' a ' + to); UI.printPage(); });
  }

  load();
});
