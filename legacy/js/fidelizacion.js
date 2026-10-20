document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const app = document.getElementById('app');
  const isAdmin = AUTH.isAdmin();
  let data = null;
  let settings = null;

  function load() {
    return Promise.all([DataService.all(['pets', 'owners', 'visits', 'packages', 'packageTypes']), DataService.getSettings()])
      .then(r => { data = r[0]; settings = r[1]; render(); });
  }

  function render() {
    const L = settings.loyalty;
    const owners = Util.byId(data.owners);

    const progress = data.pets.map(p => ({ pet: p, info: Logic.loyaltyInfo(p.id, data.visits, settings) }))
      .sort((a, b) => b.info.inCycle - a.info.inCycle || a.pet.name.localeCompare(b.pet.name));

    const referrers = data.owners.map(o => ({
      owner: o,
      referred: data.owners.filter(x => x.referredBy === o.id),
      credits: Logic.referralCredits(o, data.owners, data.visits)
    })).filter(r => r.referred.length);

    app.innerHTML =
      '<div class="section-title" style="margin-top:0"><h2>⚙️ Reglas de descuento</h2></div>' +
      (isAdmin
        ? '<form id="loyaltyForm" class="date-range-bar">' +
            '<div class="field"><label for="ly_n">Cada cuántos baños hay premio</label><input type="number" id="ly_n" min="2" value="' + L.everyN + '"></div>' +
            '<div class="field"><label for="ly_pct">Descuento del baño premiado (%)</label><input type="number" id="ly_pct" min="0" max="100" value="' + L.pct + '"></div>' +
            '<div class="field"><label for="ly_bd">Cumpleaños de la mascota (%)</label><input type="number" id="ly_bd" min="0" max="100" value="' + L.birthdayPct + '"></div>' +
            '<div class="field"><label for="ly_ref">Referidos (%)</label><input type="number" id="ly_ref" min="0" max="100" value="' + L.referralPct + '"></div>' +
            '<button class="btn btn-primary" type="submit">Guardar reglas</button></form>'
        : '<div class="alert-box info">El baño #' + L.everyN + ' tiene ' + L.pct + '% de descuento · cumpleaños ' + L.birthdayPct + '% · referidos ' + L.referralPct + '%.</div>') +
      '<p class="muted" style="margin-top:-8px">Los descuentos se ofrecen automáticamente al registrar un servicio. El cumpleaños aplica una semana antes y una semana después.</p>' +

      '<div class="section-title"><h2>🐾 Contador de baños por mascota</h2></div>' +
      (progress.length ? UI.table(['Mascota', 'Dueño', 'Progreso', 'Baños totales', 'Estado'], progress.map(x => ({
        cells: [
          '<div class="avatar-stack"><span class="pill">' + UI.petAvatar(x.pet, 'sm') + '<strong>' + UI.escapeHtml(x.pet.name) + '</strong></span></div>',
          UI.escapeHtml((owners[x.pet.ownerId] || {}).name || '—'),
          '<div style="min-width:120px"><div style="font-size:.78rem">' + x.info.inCycle + ' de ' + x.info.everyN + '</div><div class="progress"><div style="width:' + Math.round(x.info.inCycle / x.info.everyN * 100) + '%"></div></div></div>',
          String(x.info.done),
          x.info.nextIsReward ? '<span class="chip green">🎁 El próximo tiene ' + L.pct + '%</span>' : '<span class="muted">Faltan ' + (x.info.remaining - 1) + ' baño(s) para el premio</span>'
        ]
      }))) : UI.emptyState('🐾', 'Aún no hay mascotas.')) +

      '<div class="section-title"><h2>📦 Paquetes prepagados</h2><div style="display:flex;gap:8px;flex-wrap:wrap">' +
        (isAdmin ? '<button class="btn btn-secondary btn-sm" id="addTypeBtn">+ Nuevo tipo de paquete</button>' : '') +
        '<button class="btn btn-primary btn-sm" id="sellBtn">Vender paquete</button></div></div>' +
      (isAdmin && data.packageTypes.length ? UI.table(['Paquete', 'Baños', 'Precio', 'Acciones'], data.packageTypes.map(t => ({
        cells: [UI.escapeHtml(t.name), String(t.qty), UI.formatCurrency(t.price),
          '<div class="row-actions"><button class="btn btn-secondary btn-sm" data-edittype="' + t.id + '">✏️</button><button class="btn btn-secondary btn-sm" data-deltype="' + t.id + '">🗑️</button></div>']
      })), { numCols: [1, 2] }) : '') +
      '<h3 style="margin:18px 0 8px;font-size:1rem">Paquetes vendidos</h3>' +
      (data.packages.length ? UI.table(['Mascota', 'Paquete', 'Restantes', 'Pagó', 'Comprado'], data.packages.slice().sort((a, b) => (a.purchasedAt < b.purchasedAt ? 1 : -1)).map(k => {
        const pet = data.pets.find(p => p.id === k.petId) || {};
        return { cells: [UI.escapeHtml(pet.name || '—'), UI.escapeHtml(k.name),
          k.remaining > 0 ? '<span class="chip blue">' + k.remaining + ' de ' + k.total + '</span>' : '<span class="chip gray">Agotado</span>',
          UI.formatCurrency(k.price) + ' <span class="muted">(' + Logic.payLabel(k.payMethod) + ')</span>', Util.formatShort(k.purchasedAt)] };
      })) : '<p class="muted">Todavía no se han vendido paquetes.</p>') +

      '<div class="section-title"><h2>🤝 Referidos</h2></div>' +
      (referrers.length ? UI.table(['Cliente', 'Ha referido a', 'Recompensas disponibles'], referrers.map(r => ({
        cells: ['<strong>' + UI.escapeHtml(r.owner.name) + '</strong>', UI.escapeHtml(r.referred.map(x => x.name).join(', ')),
          r.credits ? '<span class="chip green">🎁 ' + r.credits + ' (' + L.referralPct + '% c/u)</span>' : '<span class="muted">Ninguna</span>']
      }))) : '<p class="muted">Cuando registres un cliente como “referido por” otro, aparecerá aquí.</p>');

    wire();
  }

  function wire() {
    const form = document.getElementById('loyaltyForm');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const val = id => Number(document.getElementById(id).value) || 0;
      DataService.saveSettings({ loyalty: { everyN: Math.max(2, val('ly_n')), pct: val('ly_pct'), birthdayPct: val('ly_bd'), referralPct: val('ly_ref') } }).then(() => {
        UI.logAction('Reglas de fidelización actualizadas', '');
        UI.showToast('Reglas guardadas', 'success');
        load();
      });
    });
    document.getElementById('sellBtn').addEventListener('click', sellForm);
    const add = document.getElementById('addTypeBtn');
    if (add) add.addEventListener('click', () => typeForm(null));
    app.querySelectorAll('[data-edittype]').forEach(b => b.addEventListener('click', () => typeForm(b.getAttribute('data-edittype'))));
    app.querySelectorAll('[data-deltype]').forEach(b => b.addEventListener('click', () => {
      if (confirm('¿Eliminar este tipo de paquete? Los ya vendidos se conservan.')) DataService.packageTypes.remove(b.getAttribute('data-deltype')).then(load);
    }));
  }

  function typeForm(id) {
    const t = id ? data.packageTypes.find(x => x.id === id) : { name: '', qty: 4, price: 0 };
    UI.openModal(
      '<h2>' + (id ? '✏️ Editar paquete' : '📦 Nuevo tipo de paquete') + '</h2>' +
      '<form id="typeForm">' +
        '<div class="field"><label for="tf_name">Nombre</label><input id="tf_name" required value="' + UI.escapeHtml(t.name) + '" placeholder="Paquete 4 baños (pequeño)"></div>' +
        '<div class="form-grid-2"><div class="field"><label for="tf_qty">Cantidad de baños</label><input type="number" id="tf_qty" min="1" value="' + t.qty + '"></div>' +
        '<div class="field"><label for="tf_price">Precio</label><input type="number" id="tf_price" min="0" value="' + t.price + '"></div></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="tf_cancel">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>' +
      '</form>'
    );
    document.getElementById('tf_cancel').addEventListener('click', UI.closeModal);
    document.getElementById('typeForm').addEventListener('submit', e => {
      e.preventDefault();
      const payload = { name: document.getElementById('tf_name').value.trim(), qty: Number(document.getElementById('tf_qty').value) || 1, price: Number(document.getElementById('tf_price').value) || 0 };
      (id ? DataService.packageTypes.update(id, payload) : DataService.packageTypes.add(payload)).then(() => { UI.showToast('Paquete guardado', 'success'); UI.closeModal(); load(); });
    });
  }

  function sellForm() {
    if (!data.packageTypes.length) { UI.showToast('Primero crea un tipo de paquete (lo hace el administrador)', 'danger'); return; }
    const owners = Util.byId(data.owners);
    const pets = data.pets.slice().sort((a, b) => a.name.localeCompare(b.name));
    UI.openModal(
      '<h2>📦 Vender paquete prepagado</h2>' +
      '<form id="sellForm">' +
        '<div class="field"><label for="sl_pet">Mascota</label><select id="sl_pet">' + pets.map(p => '<option value="' + p.id + '">' + UI.escapeHtml(p.name) + ' — ' + UI.escapeHtml((owners[p.ownerId] || {}).name || '') + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="sl_type">Paquete</label><select id="sl_type">' + data.packageTypes.map(t => '<option value="' + t.id + '">' + UI.escapeHtml(t.name) + ' — ' + UI.formatCurrency(t.price) + '</option>').join('') + '</select></div>' +
        '<div class="form-grid-2"><div class="field"><label for="sl_price">Precio cobrado</label><input type="number" id="sl_price" min="0"></div>' +
        '<div class="field"><label for="sl_pay">Método de pago</label><select id="sl_pay">' + Logic.PAY_METHODS.filter(m => m.key !== 'paquete').map(m => '<option value="' + m.key + '">' + m.label + '</option>').join('') + '</select></div></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="sl_cancel">Cancelar</button><button class="btn btn-primary" type="submit">Vender</button></div>' +
      '</form>'
    );
    const $ = id => document.getElementById(id);
    UI.enhanceSelect($('sl_pet'));
    const syncPrice = () => { $('sl_price').value = data.packageTypes.find(t => t.id === $('sl_type').value).price; };
    syncPrice();
    $('sl_type').addEventListener('change', syncPrice);
    $('sl_cancel').addEventListener('click', UI.closeModal);
    $('sellForm').addEventListener('submit', e => {
      e.preventDefault();
      const type = data.packageTypes.find(t => t.id === $('sl_type').value);
      const pet = data.pets.find(p => p.id === $('sl_pet').value);
      DataService.packages.add({
        petId: pet.id, ownerId: pet.ownerId, typeId: type.id, name: type.name, total: type.qty, remaining: type.qty,
        price: Number($('sl_price').value) || 0, payMethod: $('sl_pay').value, purchasedAt: Util.today()
      }).then(() => {
        UI.logAction('Paquete vendido', pet.name + ' — ' + type.name);
        UI.showToast('Paquete vendido', 'success');
        UI.closeModal();
        load();
      });
    });
  }

  load();
});
