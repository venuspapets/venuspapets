/**
 * forms.js — Formularios de cliente (dueño) y mascota, compartidos por
 * la lista de clientes y la ficha del cliente.
 */

const OwnerForm = (function () {
  /** OwnerForm.open(ownerId | null, onSaved(owner)) */
  function open(ownerId, onSaved) {
    DataService.all(['owners']).then(function (d) {
      const owner = ownerId ? d.owners.find(o => o.id === ownerId) : null;
      const o = owner || { name: '', whatsapp: '', address: '', birthday: '', referredBy: '', consent: false, notes: '' };
      const referrers = d.owners.filter(x => !owner || x.id !== owner.id).sort((a, b) => a.name.localeCompare(b.name));

      UI.openModal(
        '<h2>' + (owner ? '✏️ Editar cliente' : '👤 Nuevo cliente') + '</h2>' +
        '<p class="modal-subtitle">Datos del dueño de la mascota.</p>' +
        '<form id="ownerForm">' +
          '<div class="field"><label for="of_name">Nombre completo</label><input id="of_name" required value="' + UI.escapeHtml(o.name) + '"></div>' +
          '<div class="form-grid-2">' +
            '<div class="field"><label for="of_wa">WhatsApp</label><input id="of_wa" type="tel" required placeholder="3001234567" value="' + UI.escapeHtml(o.whatsapp) + '"></div>' +
            '<div class="field"><label for="of_bday">Cumpleaños</label><input id="of_bday" type="date" value="' + (o.birthday || '') + '"></div>' +
          '</div>' +
          '<div class="field"><label for="of_addr">Dirección</label><input id="of_addr" value="' + UI.escapeHtml(o.address || '') + '"></div>' +
          '<div class="field"><label for="of_ref">¿Lo refirió otro cliente?</label><select id="of_ref"><option value="">— Nadie —</option>' +
            referrers.map(r => '<option value="' + r.id + '"' + (o.referredBy === r.id ? ' selected' : '') + '>' + UI.escapeHtml(r.name) + '</option>').join('') +
          '</select><div class="field-hint">El referido y quien lo refirió reciben descuento (configurable en Fidelización).</div></div>' +
          '<label class="check-row"><input type="checkbox" id="of_consent" required' + (o.consent ? ' checked' : '') + '>' +
            '<span><strong>Autorización de tratamiento de datos (Habeas Data, Ley 1581 de 2012).</strong> El cliente autoriza a VenuSpa Pets a guardar y usar sus datos y los de su mascota para agendar citas, enviarle recordatorios por WhatsApp y fidelización.</span></label>' +
          '<div class="field"><label for="of_notes">Notas</label><textarea id="of_notes">' + UI.escapeHtml(o.notes || '') + '</textarea></div>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary" id="of_cancel">Cancelar</button>' +
            '<button type="submit" class="btn btn-primary">Guardar</button>' +
          '</div>' +
        '</form>'
      );

      UI.enhanceSelect(document.getElementById('of_ref'));
      document.getElementById('of_cancel').addEventListener('click', UI.closeModal);
      document.getElementById('ownerForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const phone = Util.normalizePhone(document.getElementById('of_wa').value);
        if (phone.length < 10) { UI.showToast('Revisa el número de WhatsApp', 'danger'); return; }
        const payload = {
          name: document.getElementById('of_name').value.trim(),
          whatsapp: document.getElementById('of_wa').value.trim(),
          birthday: document.getElementById('of_bday').value,
          address: document.getElementById('of_addr').value.trim(),
          referredBy: document.getElementById('of_ref').value || null,
          consent: document.getElementById('of_consent').checked,
          notes: document.getElementById('of_notes').value.trim()
        };
        if (!owner || !owner.consent) payload.consentDate = Util.today();
        const job = owner ? DataService.owners.update(owner.id, payload) : DataService.owners.add(Object.assign({ referralRewardsUsed: 0 }, payload));
        job.then(saved => {
          UI.logAction(owner ? 'Cliente editado' : 'Cliente creado', saved.name);
          UI.showToast('Cliente guardado', 'success');
          UI.closeModal();
          if (onSaved) onSaved(saved);
        });
      });
    });
  }

  return { open };
})();

const PetForm = (function () {
  const BREEDS = ['Schnauzer', 'Poodle', 'Golden Retriever', 'Labrador', 'Pug', 'Bulldog Francés', 'Bulldog Inglés', 'Shih Tzu', 'Yorkshire', 'Pomerania',
    'Criollo', 'Husky', 'Beagle', 'Chihuahua', 'Pastor Alemán', 'Maltés', 'Cocker Spaniel', 'West Highland', 'Border Collie', 'Rottweiler', 'Salchicha', 'Pinscher', 'Samoyedo', 'Akita'];
  const TEMPERAMENTS = ['Tranquilo', 'Juguetón', 'Nervioso', 'Agresivo'];

  /** PetForm.open(petId | null, ownerId, onSaved(pet)) */
  function open(petId, ownerId, onSaved) {
    DataService.all(['pets']).then(function (d) {
      const pet = petId ? d.pets.find(p => p.id === petId) : null;
      const p = pet || { name: '', breed: '', size: 'pequeno', birthdate: '', temperament: 'Tranquilo', allergies: '', preferredCut: '', frequencyDays: 30, notes: '', photo: null, vaccines: [] };
      const vaccines = (p.vaccines || []).map(v => Object.assign({}, v));

      UI.openModal(
        '<h2>' + (pet ? '✏️ Editar mascota' : '🐶 Nueva mascota') + '</h2>' +
        '<form id="petForm">' +
          '<div class="field"><label>Foto de perfil</label><div class="photo-box">' +
            '<img id="pf_img" class="hidden" alt="Foto" style="height:140px">' +
            '<input type="file" id="pf_photo" accept="image/*"></div></div>' +
          '<div class="form-grid-2">' +
            '<div class="field"><label for="pf_name">Nombre</label><input id="pf_name" required value="' + UI.escapeHtml(p.name) + '"></div>' +
            '<div class="field"><label for="pf_breed">Raza</label><input id="pf_breed" list="pf_breeds" value="' + UI.escapeHtml(p.breed) + '">' +
              '<datalist id="pf_breeds">' + BREEDS.map(b => '<option value="' + b + '">').join('') + '</datalist></div>' +
          '</div>' +
          '<div class="form-grid-2">' +
            '<div class="field"><label for="pf_size">Tamaño</label><select id="pf_size">' +
              Logic.SIZES.map(s => '<option value="' + s.key + '"' + (p.size === s.key ? ' selected' : '') + '>' + s.label + ' (' + s.hint + ')</option>').join('') +
            '</select></div>' +
            '<div class="field"><label for="pf_bday">Fecha de nacimiento</label><input type="date" id="pf_bday" value="' + (p.birthdate || '') + '">' +
              '<div class="field-hint">Si no la sabes, pon una aproximada (sirve para edad y cumpleaños).</div></div>' +
          '</div>' +
          '<div class="form-grid-2">' +
            '<div class="field"><label for="pf_temper">Temperamento</label><select id="pf_temper">' +
              TEMPERAMENTS.map(t => '<option' + (p.temperament === t ? ' selected' : '') + '>' + t + '</option>').join('') +
            '</select></div>' +
            '<div class="field"><label for="pf_freq">Cada cuántos días toca baño</label><input type="number" id="pf_freq" min="7" value="' + (p.frequencyDays || 30) + '"></div>' +
          '</div>' +
          '<div class="field"><label for="pf_allergies">Alergias o condiciones de piel</label><input id="pf_allergies" value="' + UI.escapeHtml(p.allergies || '') + '"></div>' +
          '<div class="field"><label for="pf_cut">Corte preferido</label><input id="pf_cut" value="' + UI.escapeHtml(p.preferredCut || '') + '"></div>' +
          '<div class="field"><label>Vacunas</label><div id="pf_vaccines"></div>' +
            '<button type="button" class="btn btn-secondary btn-sm" id="pf_addVac" style="margin-top:6px">+ Agregar vacuna</button></div>' +
          '<div class="field"><label for="pf_notes">Notas especiales</label><textarea id="pf_notes">' + UI.escapeHtml(p.notes || '') + '</textarea></div>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary" id="pf_cancel">Cancelar</button>' +
            '<button type="submit" class="btn btn-primary">Guardar</button>' +
          '</div>' +
        '</form>',
        { closeOnOverlay: false }
      );

      const $ = id => document.getElementById(id);
      const photo = UI.wirePhotoInput($('pf_photo'), $('pf_img'), p.photo);

      function renderVaccines() {
        $('pf_vaccines').innerHTML = vaccines.length ? vaccines.map((v, i) =>
          '<div class="form-grid-3" style="align-items:end;margin-bottom:8px">' +
            '<div class="field" style="margin:0"><label>Vacuna</label><input data-vac="' + i + '" data-f="name" value="' + UI.escapeHtml(v.name || '') + '" placeholder="Rabia"></div>' +
            '<div class="field" style="margin:0"><label>Aplicada</label><input type="date" data-vac="' + i + '" data-f="date" value="' + (v.date || '') + '"></div>' +
            '<div class="field" style="margin:0"><label>Próxima <button type="button" data-delvac="' + i + '" style="border:none;background:none;cursor:pointer" title="Quitar">🗑️</button></label>' +
              '<input type="date" data-vac="' + i + '" data-f="next" value="' + (v.next || '') + '"></div>' +
          '</div>'
        ).join('') : '<div class="field-hint">Sin vacunas registradas.</div>';
      }
      renderVaccines();

      $('pf_vaccines').addEventListener('input', e => {
        if (e.target.hasAttribute('data-vac')) vaccines[e.target.getAttribute('data-vac')][e.target.getAttribute('data-f')] = e.target.value;
      });
      $('pf_vaccines').addEventListener('click', e => {
        const del = e.target.closest('[data-delvac]');
        if (del) { vaccines.splice(Number(del.getAttribute('data-delvac')), 1); renderVaccines(); }
      });
      $('pf_addVac').addEventListener('click', () => { vaccines.push({ name: '', date: '', next: '' }); renderVaccines(); });
      $('pf_cancel').addEventListener('click', UI.closeModal);

      $('petForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const payload = {
          name: $('pf_name').value.trim(),
          breed: $('pf_breed').value.trim(),
          size: $('pf_size').value,
          birthdate: $('pf_bday').value,
          temperament: $('pf_temper').value,
          frequencyDays: Number($('pf_freq').value) || 30,
          allergies: $('pf_allergies').value.trim(),
          preferredCut: $('pf_cut').value.trim(),
          vaccines: vaccines.filter(v => v.name && v.name.trim()),
          notes: $('pf_notes').value.trim(),
          photo: photo.get()
        };
        const job = pet ? DataService.pets.update(pet.id, payload) : DataService.pets.add(Object.assign({ ownerId }, payload));
        job.then(saved => {
          UI.logAction(pet ? 'Mascota editada' : 'Mascota creada', saved.name);
          UI.showToast('Mascota guardada', 'success');
          UI.closeModal();
          if (onSaved) onSaved(saved);
        });
      });
    });
  }

  return { open };
})();

const ExpenseForm = (function () {
  /** ExpenseForm.open(expenseId | null, onSaved(expense), defaults?) — gasto con su método de pago (para el arqueo de caja). */
  function open(expenseId, onSaved, defaults) {
    DataService.expenses.list().then(function (list) {
      const e = (expenseId && list.find(x => x.id === expenseId)) ||
        Object.assign({ date: Util.today(), category: Logic.EXPENSE_CATEGORIES[0], description: '', amount: 0, payMethod: 'efectivo' }, defaults || {});
      const methods = Logic.PAY_METHODS.filter(m => m.key !== 'paquete');
      UI.openModal(
        '<h2>' + (expenseId ? '✏️ Editar gasto' : '📉 Registrar gasto') + '</h2>' +
        '<form id="expForm">' +
          '<div class="form-grid-2"><div class="field"><label for="ex_date">Fecha</label><input type="date" id="ex_date" value="' + e.date + '" required></div>' +
          '<div class="field"><label for="ex_cat">Categoría</label><select id="ex_cat">' + Logic.EXPENSE_CATEGORIES.map(c => '<option' + (c === e.category ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div></div>' +
          '<div class="form-grid-2"><div class="field"><label for="ex_amount">Monto</label><input type="number" id="ex_amount" min="0" value="' + e.amount + '" required></div>' +
          '<div class="field"><label for="ex_pay">Se pagó con</label><select id="ex_pay">' + methods.map(m => '<option value="' + m.key + '"' + ((e.payMethod || 'efectivo') === m.key ? ' selected' : '') + '>' + m.label + '</option>').join('') + '</select></div></div>' +
          '<div class="field-hint" style="margin:-8px 0 14px">Si se pagó en efectivo desde la caja, se descuenta en el arqueo del día.</div>' +
          '<div class="field"><label for="ex_desc">Descripción</label><input id="ex_desc" value="' + UI.escapeHtml(e.description || '') + '" placeholder="Ej: Arriendo del local"></div>' +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="ex_cancel">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>' +
        '</form>'
      );
      document.getElementById('ex_cancel').addEventListener('click', UI.closeModal);
      document.getElementById('expForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        const payload = {
          date: document.getElementById('ex_date').value, category: document.getElementById('ex_cat').value,
          amount: Number(document.getElementById('ex_amount').value) || 0, payMethod: document.getElementById('ex_pay').value,
          description: document.getElementById('ex_desc').value.trim()
        };
        (expenseId ? DataService.expenses.update(expenseId, payload) : DataService.expenses.add(payload)).then(function (saved) {
          UI.logAction(expenseId ? 'Gasto editado' : 'Gasto registrado', payload.category + ' — ' + UI.formatCurrency(payload.amount));
          UI.showToast('Gasto guardado', 'success');
          UI.closeModal();
          if (onSaved) onSaved(saved);
        });
      });
    });
  }
  return { open };
})();
