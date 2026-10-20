document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAdmin();

  const app = document.getElementById('app');
  let data = null;
  let settings = null;

  function load() {
    return Promise.all([DataService.all(['services', 'visits']), DataService.getSettings()])
      .then(r => { data = r[0]; settings = r[1]; render(); });
  }

  function render() {
    const rows = data.services.slice().sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'base' ? -1 : 1));

    app.innerHTML =
      '<div class="action-buttons-row">' +
        '<button class="btn btn-primary btn-feature" id="addServiceBtn">+ Nuevo servicio</button>' +
      '</div>' +
      (rows.length ? UI.table(
        ['Servicio', 'Tipo'].concat(Logic.SIZES.map(s => s.label)).concat(['Min. extra', 'Acciones']),
        rows.map(s => ({
          cells: [
            '<strong>' + UI.escapeHtml(s.name) + '</strong>' + (s.breedPrices && s.breedPrices.length ? '<div class="muted" style="font-size:.75rem">' + s.breedPrices.length + ' precio(s) por raza</div>' : '') + (s.active ? '' : ' <span class="chip gray">Inactivo</span>'),
            '<span class="chip ' + (s.type === 'base' ? '' : 'blue') + '">' + (s.type === 'base' ? 'Principal' : 'Adicional') + '</span>'
          ].concat(Logic.SIZES.map(z => UI.formatCurrency(s.prices[z.key]))).concat([
            s.extraMin ? '+' + s.extraMin + ' min' : '—',
            '<div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit="' + s.id + '">✏️ Editar</button>' +
            '<button class="btn btn-secondary btn-sm" data-del="' + s.id + '">🗑️</button></div>'
          ])
        })), { numCols: [2, 3, 4, 5] }) : UI.emptyState('✂️', 'Aún no hay servicios.')) +

      '<div class="section-title"><h2>⏱️ Duración base por tamaño</h2></div>' +
      '<p class="muted" style="margin-top:-6px">Se usa para calcular cuánto dura cada cita en la agenda (más los minutos extra de cada servicio).</p>' +
      '<form id="durForm" class="date-range-bar">' +
        Logic.SIZES.map(s => '<div class="field"><label for="dur_' + s.key + '">' + s.label + ' (min)</label><input type="number" min="15" step="5" id="dur_' + s.key + '" value="' + settings.sizeDurations[s.key] + '"></div>').join('') +
        '<button class="btn btn-primary" type="submit">Guardar</button>' +
      '</form>';

    document.getElementById('addServiceBtn').addEventListener('click', () => serviceForm(null));
    app.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => serviceForm(b.getAttribute('data-edit'))));
    app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const s = data.services.find(x => x.id === b.getAttribute('data-del'));
      if (data.visits.some(v => v.items.some(i => i.serviceId === s.id))) {
        if (!confirm('"' + s.name + '" ya se usó en visitas. En vez de borrarlo se marcará como inactivo para conservar el historial. ¿Continuar?')) return;
        DataService.services.update(s.id, { active: false }).then(() => { UI.showToast('Servicio desactivado', 'success'); load(); });
        return;
      }
      if (confirm('¿Eliminar "' + s.name + '"?')) DataService.services.remove(s.id).then(() => { UI.logAction('Servicio eliminado', s.name); load(); });
    }));
    document.getElementById('durForm').addEventListener('submit', e => {
      e.preventDefault();
      const durations = {};
      Logic.SIZES.forEach(s => { durations[s.key] = Number(document.getElementById('dur_' + s.key).value) || 60; });
      DataService.saveSettings({ sizeDurations: durations }).then(() => { UI.showToast('Duraciones guardadas', 'success'); load(); });
    });
  }

  function serviceForm(id) {
    const s = id ? data.services.find(x => x.id === id) : { name: '', type: 'base', prices: { pequeno: 0, mediano: 0, grande: 0, gigante: 0 }, extraMin: 0, breedPrices: [], active: true };
    const breedPrices = (s.breedPrices || []).map(b => Object.assign({}, b));

    UI.openModal(
      '<h2>' + (id ? '✏️ Editar servicio' : '✂️ Nuevo servicio') + '</h2>' +
      '<form id="svcForm">' +
        '<div class="form-grid-2">' +
          '<div class="field"><label for="sf_name">Nombre</label><input id="sf_name" required value="' + UI.escapeHtml(s.name) + '"></div>' +
          '<div class="field"><label for="sf_type">Tipo</label><select id="sf_type"><option value="base"' + (s.type === 'base' ? ' selected' : '') + '>Principal (baño, corte...)</option><option value="adicional"' + (s.type === 'adicional' ? ' selected' : '') + '>Adicional</option></select></div>' +
        '</div>' +
        '<div class="field"><label>Precio por tamaño</label><div class="form-grid-2">' +
          Logic.SIZES.map(z => '<div class="field"><label for="sf_p_' + z.key + '" style="font-weight:500">' + z.label + '</label><input type="number" min="0" id="sf_p_' + z.key + '" value="' + s.prices[z.key] + '"></div>').join('') +
        '</div></div>' +
        '<div class="field"><label for="sf_extra">Minutos extra de duración</label><input type="number" min="0" id="sf_extra" value="' + (s.extraMin || 0) + '"></div>' +
        '<div class="field"><label>Precios especiales por raza</label><div id="sf_breeds"></div>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="sf_addBreed" style="margin-top:6px">+ Agregar raza</button>' +
          '<div class="field-hint">Si la raza de la mascota coincide, se usa este precio en lugar del precio por tamaño.</div></div>' +
        '<label class="check-row"><input type="checkbox" id="sf_active"' + (s.active ? ' checked' : '') + '><span>Servicio activo (aparece al agendar y registrar)</span></label>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="sf_cancel">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>' +
      '</form>'
    );

    const $ = x => document.getElementById(x);
    function renderBreeds() {
      $('sf_breeds').innerHTML = breedPrices.map((b, i) =>
        '<div class="form-grid-2" style="align-items:end;margin-bottom:6px">' +
          '<div class="field" style="margin:0"><input data-b="' + i + '" data-f="breed" placeholder="Raza (ej: Schnauzer)" value="' + UI.escapeHtml(b.breed) + '"></div>' +
          '<div class="field" style="margin:0;display:flex;gap:6px"><input type="number" min="0" data-b="' + i + '" data-f="price" value="' + b.price + '"><button type="button" class="btn btn-secondary btn-sm" data-delb="' + i + '">🗑️</button></div>' +
        '</div>').join('');
    }
    renderBreeds();
    $('sf_breeds').addEventListener('input', e => { if (e.target.hasAttribute('data-b')) breedPrices[e.target.getAttribute('data-b')][e.target.getAttribute('data-f')] = e.target.value; });
    $('sf_breeds').addEventListener('click', e => { const d = e.target.closest('[data-delb]'); if (d) { breedPrices.splice(Number(d.getAttribute('data-delb')), 1); renderBreeds(); } });
    $('sf_addBreed').addEventListener('click', () => { breedPrices.push({ breed: '', price: 0 }); renderBreeds(); });
    $('sf_cancel').addEventListener('click', UI.closeModal);

    $('svcForm').addEventListener('submit', e => {
      e.preventDefault();
      const prices = {};
      Logic.SIZES.forEach(z => { prices[z.key] = Number($('sf_p_' + z.key).value) || 0; });
      const payload = {
        name: $('sf_name').value.trim(), type: $('sf_type').value, prices, extraMin: Number($('sf_extra').value) || 0,
        breedPrices: breedPrices.filter(b => b.breed && b.breed.trim()).map(b => ({ breed: b.breed.trim(), price: Number(b.price) || 0 })),
        active: $('sf_active').checked
      };
      (id ? DataService.services.update(id, payload) : DataService.services.add(payload)).then(() => {
        UI.logAction(id ? 'Servicio editado' : 'Servicio creado', payload.name);
        UI.showToast('Servicio guardado', 'success');
        UI.closeModal();
        load();
      });
    });
  }

  load();
});
