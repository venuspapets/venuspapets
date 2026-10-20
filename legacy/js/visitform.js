/**
 * visitform.js — Formulario compartido para registrar un servicio realizado
 * (se usa desde Agenda, Caja y la ficha del cliente).
 *
 * VisitForm.open({ petId, appointmentId, date, onSaved })
 */

const VisitForm = (function () {
  function open(opts) {
    opts = opts || {};
    return Promise.all([
      DataService.all(['pets', 'owners', 'services', 'groomers', 'visits', 'packages', 'appointments']),
      DataService.getSettings()
    ]).then(r => render(r[0], r[1], opts));
  }

  function nowTime() {
    const n = new Date();
    return Util.pad(n.getHours()) + ':' + Util.pad(n.getMinutes());
  }

  function render(d, settings, opts) {
    if (!d.pets.length) {
      UI.showToast('Primero registra una mascota en Clientes y Mascotas', 'danger');
      return;
    }
    const owners = Util.byId(d.owners);
    const appt = opts.appointmentId ? d.appointments.find(a => a.id === opts.appointmentId) : null;
    const pets = d.pets.slice().sort((a, b) => a.name.localeCompare(b.name));
    const services = d.services.filter(s => s.active);
    const groomers = d.groomers.filter(g => g.active);

    const state = {
      petId: opts.petId || (appt && appt.petId) || pets[0].id,
      serviceIds: new Set(appt ? appt.serviceIds : []),
      usePackage: false,
      discountKey: 'auto',
      manualPct: 0
    };
    const defaultGroomer = (appt && appt.groomerId) || (groomers[0] && groomers[0].id) || '';
    const lockedPet = !!opts.petId || !!appt;

    UI.openModal(
      '<h2>🧾 Registrar servicio</h2>' +
      '<p class="modal-subtitle">Servicios realizados, descuentos, propina y método de pago.</p>' +
      '<form id="vf_form">' +
        '<div class="field"><label for="vf_pet">Mascota</label>' +
          '<select id="vf_pet"' + (lockedPet ? ' disabled' : '') + '>' +
            pets.map(p => '<option value="' + p.id + '"' + (p.id === state.petId ? ' selected' : '') + '>' +
              UI.escapeHtml(p.name) + ' — ' + UI.escapeHtml((owners[p.ownerId] || {}).name || '') + '</option>').join('') +
          '</select></div>' +
        '<div class="form-grid-2">' +
          '<div class="field"><label for="vf_date">Fecha</label><input type="date" id="vf_date" value="' + (opts.date || (appt && appt.date) || Util.today()) + '" required></div>' +
          '<div class="field"><label for="vf_groomer">Groomer</label><select id="vf_groomer">' +
            groomers.map(g => '<option value="' + g.id + '"' + (g.id === defaultGroomer ? ' selected' : '') + '>' + UI.escapeHtml(g.name) + '</option>').join('') +
          '</select></div>' +
        '</div>' +
        '<div class="field"><label>Servicios</label><div class="service-pick" id="vf_services"></div></div>' +
        '<div id="vf_package"></div>' +
        '<div class="field"><label>Descuento</label><div class="discount-list" id="vf_discounts"></div></div>' +
        '<div class="form-grid-2">' +
          '<div class="field"><label for="vf_tip">Propina</label><input type="number" id="vf_tip" min="0" value="0"></div>' +
          '<div class="field"><label for="vf_pay">Método de pago</label><select id="vf_pay">' +
            Logic.PAY_METHODS.filter(m => m.key !== 'paquete').map(m => '<option value="' + m.key + '">' + m.label + '</option>').join('') +
          '</select></div>' +
        '</div>' +
        '<div class="field"><label>Fotos (opcional)</label><div class="photo-pair">' +
          '<div class="photo-box"><img id="vf_beforeImg" class="hidden" alt="Antes">Antes<input type="file" id="vf_before" accept="image/*"></div>' +
          '<div class="photo-box"><img id="vf_afterImg" class="hidden" alt="Después">Después<input type="file" id="vf_after" accept="image/*"></div>' +
        '</div></div>' +
        '<div class="field"><label for="vf_notes">Notas</label><textarea id="vf_notes" placeholder="Observaciones del servicio"></textarea></div>' +
        '<div class="total-box" id="vf_total"></div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" id="vf_cancel">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Guardar servicio</button>' +
        '</div>' +
      '</form>',
      { wide: true, closeOnOverlay: false }
    );

    const $ = id => document.getElementById(id);
    UI.enhanceSelect($('vf_pet'));
    const beforePhoto = UI.wirePhotoInput($('vf_before'), $('vf_beforeImg'));
    const afterPhoto = UI.wirePhotoInput($('vf_after'), $('vf_afterImg'));

    function currentPet() { return d.pets.find(p => p.id === state.petId); }
    function currentPackage() { return d.packages.find(p => p.petId === state.petId && p.remaining > 0) || null; }

    function selectedItems() {
      const pet = currentPet();
      return services.filter(s => state.serviceIds.has(s.id)).map(s => ({
        serviceId: s.id, name: s.name, type: s.type, price: Logic.priceFor(s, pet)
      }));
    }

    function discounts() {
      if (state.usePackage) return [];
      const pet = currentPet();
      return Logic.eligibleDiscounts({ pet, owner: owners[pet.ownerId], owners: d.owners, visits: d.visits, settings, date: $('vf_date').value });
    }

    function renderServices() {
      const pet = currentPet();
      const group = (title, type) => {
        const list = services.filter(s => s.type === type);
        if (!list.length) return '';
        return '<div class="group-title">' + title + '</div>' + list.map(s =>
          '<label><span><input type="checkbox" data-service="' + s.id + '"' + (state.serviceIds.has(s.id) ? ' checked' : '') + '> ' +
          UI.escapeHtml(s.name) + '</span><span class="price">' + UI.formatCurrency(Logic.priceFor(s, pet)) + '</span></label>'
        ).join('');
      };
      $('vf_services').innerHTML = group('Servicios principales', 'base') + group('Adicionales', 'adicional');
    }

    function renderPackage() {
      const pkg = currentPackage();
      if (!pkg) { state.usePackage = false; $('vf_package').innerHTML = ''; return; }
      $('vf_package').innerHTML =
        '<label class="check-row"><input type="checkbox" id="vf_usePkg"' + (state.usePackage ? ' checked' : '') + '>' +
        '<span><strong>Usar paquete prepagado</strong> — ' + UI.escapeHtml(pkg.name) + ' (restan ' + pkg.remaining + ' de ' + pkg.total + '). ' +
        'Cubre el servicio principal; los adicionales se cobran aparte.</span></label>';
    }

    function renderDiscounts() {
      const list = discounts();
      if (state.discountKey === 'auto') {
        const best = list.slice().sort((a, b) => b.pct - a.pct)[0];
        state.discountKey = best ? best.key : 'none';
      }
      if (state.discountKey !== 'none' && state.discountKey !== 'manual' && !list.some(x => x.key === state.discountKey)) state.discountKey = 'none';
      if (state.usePackage) state.discountKey = 'none';

      const radio = (key, text, checked) =>
        '<label><input type="radio" name="vf_disc" value="' + key + '"' + (checked ? ' checked' : '') + '> ' + text + '</label>';
      $('vf_discounts').innerHTML =
        radio('none', 'Sin descuento', state.discountKey === 'none') +
        list.map(x => radio(x.key, '🎁 ' + UI.escapeHtml(x.label), state.discountKey === x.key)).join('') +
        (state.usePackage ? '' :
          '<label><input type="radio" name="vf_disc" value="manual"' + (state.discountKey === 'manual' ? ' checked' : '') + '> Otro descuento: ' +
          '<input type="number" id="vf_manualPct" min="0" max="100" value="' + state.manualPct + '"> %</label>');
    }

    function totals() {
      const items = selectedItems();
      const subtotal = Util.sum(items, i => i.price);
      const covered = state.usePackage ? Util.sum(items.filter(i => i.type === 'base'), i => i.price) : 0;
      const chargeable = subtotal - covered;
      let pct = 0;
      let key = null;
      if (state.discountKey === 'manual') { pct = Math.min(100, Math.max(0, Number(state.manualPct) || 0)); key = 'manual'; }
      else if (state.discountKey !== 'none') {
        const found = discounts().find(x => x.key === state.discountKey);
        if (found) { pct = found.pct; key = found.key; }
      }
      const discountAmount = Math.round(chargeable * pct / 100);
      return { items, subtotal, covered, pct, key, discountAmount, total: chargeable - discountAmount };
    }

    function renderTotals() {
      const t = totals();
      $('vf_total').innerHTML =
        '<div class="row"><span>Subtotal</span><span>' + UI.formatCurrency(t.subtotal) + '</span></div>' +
        (t.covered ? '<div class="row"><span>Cubierto por paquete</span><span>- ' + UI.formatCurrency(t.covered) + '</span></div>' : '') +
        (t.discountAmount ? '<div class="row"><span>Descuento (' + t.pct + '%)</span><span>- ' + UI.formatCurrency(t.discountAmount) + '</span></div>' : '') +
        '<div class="row total"><span>Total a cobrar</span><span>' + UI.formatCurrency(t.total) + '</span></div>';
    }

    function refreshAll() { renderServices(); renderPackage(); renderDiscounts(); renderTotals(); }

    const form = $('vf_form');
    form.addEventListener('change', function (e) {
      const el = e.target;
      if (el.id === 'vf_pet') { state.petId = el.value; state.discountKey = 'auto'; state.usePackage = false; refreshAll(); return; }
      if (el.id === 'vf_date') { state.discountKey = 'auto'; renderDiscounts(); renderTotals(); return; }
      if (el.hasAttribute('data-service')) {
        const id = el.getAttribute('data-service');
        if (el.checked) state.serviceIds.add(id); else state.serviceIds.delete(id);
        renderTotals();
        return;
      }
      if (el.id === 'vf_usePkg') { state.usePackage = el.checked; state.discountKey = 'auto'; renderDiscounts(); renderTotals(); return; }
      if (el.name === 'vf_disc') { state.discountKey = el.value; renderTotals(); }
    });
    form.addEventListener('input', function (e) {
      if (e.target.id === 'vf_manualPct') {
        state.manualPct = e.target.value;
        state.discountKey = 'manual';
        const manual = form.querySelector('input[name="vf_disc"][value="manual"]');
        if (manual) manual.checked = true;
        renderTotals();
      }
    });

    $('vf_cancel').addEventListener('click', UI.closeModal);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const t = totals();
      if (!t.items.length) { UI.showToast('Selecciona al menos un servicio', 'danger'); return; }
      const pet = currentPet();
      const owner = owners[pet.ownerId];
      const pkg = state.usePackage ? currentPackage() : null;

      DataService.visits.add({
        date: $('vf_date').value,
        time: appt ? appt.time : nowTime(),
        petId: pet.id,
        ownerId: pet.ownerId,
        groomerId: $('vf_groomer').value,
        items: t.items,
        subtotal: t.subtotal,
        discountKey: t.key,
        discountPct: t.pct,
        discountAmount: t.discountAmount,
        total: t.total,
        tip: Number($('vf_tip').value) || 0,
        payMethod: t.total === 0 && pkg ? 'paquete' : $('vf_pay').value,
        usedPackage: !!pkg,
        packageId: pkg ? pkg.id : null,
        beforePhoto: beforePhoto.get(),
        afterPhoto: afterPhoto.get(),
        notes: $('vf_notes').value.trim(),
        appointmentId: appt ? appt.id : null
      }).then(visit => {
        const jobs = [];
        if (pkg) jobs.push(DataService.packages.update(pkg.id, { remaining: pkg.remaining - 1 }));
        if (t.key === 'referral-referrer' && owner) jobs.push(DataService.owners.update(owner.id, { referralRewardsUsed: (owner.referralRewardsUsed || 0) + 1 }));
        if (appt) jobs.push(DataService.appointments.update(appt.id, { status: 'atendida', visitId: visit.id }));
        return Promise.all(jobs).then(() => visit);
      }).then(visit => {
        UI.logAction('Servicio registrado', pet.name + ' (' + (owner ? owner.name : '') + ') — ' + UI.formatCurrency(visit.total));
        UI.showToast('Servicio registrado', 'success');
        UI.closeModal();
        if (opts.onSaved) opts.onSaved(visit);
      });
    });

    refreshAll();
  }

  return { open };
})();
