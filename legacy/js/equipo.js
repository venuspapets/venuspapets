document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAdmin();

  const app = document.getElementById('app');
  let data = null;
  let settings = null;

  function load() {
    return Promise.all([DataService.all(['groomers', 'visits', 'appointments']), DataService.getSettings()])
      .then(r => { data = r[0]; settings = r[1]; render(); });
  }

  function render() {
    app.innerHTML =
      '<div class="section-title" style="margin-top:0"><h2>✂️ Groomers</h2><button class="btn btn-primary btn-sm" id="addGroomerBtn">+ Nuevo groomer</button></div>' +
      (data.groomers.length ? UI.table(['Nombre', 'Comisión', 'Estado', 'Acciones'], data.groomers.map(g => ({
        cells: ['<strong>' + UI.escapeHtml(g.name) + '</strong>', g.commission + '%', g.active ? '<span class="chip green">Activo</span>' : '<span class="chip gray">Inactivo</span>',
          '<div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit="' + g.id + '">✏️ Editar</button><button class="btn btn-secondary btn-sm" data-del="' + g.id + '">🗑️</button></div>']
      }))) : UI.emptyState('✂️', 'No hay groomers.')) +
      '<p class="muted">La comisión se calcula sobre los ingresos de los servicios de cada groomer y aparece en Reportes.</p>' +

      '<div class="section-title"><h2>🔑 Usuarios y roles</h2></div>' +
      UI.table(['Usuario', 'Rol', 'Puede ver'], AUTH.listUsers().map(u => ({
        cells: [UI.escapeHtml(u.username), '<span class="chip ' + (u.role === 'admin' ? '' : 'blue') + '">' + (u.role === 'admin' ? 'Administrador' : 'Empleado') + '</span>',
          u.role === 'admin' ? 'Todo: finanzas, reportes, precios, equipo y registro de actividad' : 'Clientes, agenda, caja, recordatorios, fidelización e insumos (sin finanzas)']
      }))) +
      '<p class="muted">En la versión con base de datos, los usuarios se crean y se les cambia la contraseña desde aquí.</p>' +

      '<div class="section-title"><h2>⚙️ Datos del negocio</h2></div>' +
      '<form id="bizForm" class="date-range-bar">' +
        '<div class="field"><label for="bz_owner">Nombre del dueño</label><input id="bz_owner" value="' + UI.escapeHtml(settings.ownerName) + '"></div>' +
        '<div class="field"><label for="bz_phone">WhatsApp del dueño (avisos de agenda)</label><input id="bz_phone" value="' + UI.escapeHtml(settings.ownerPhone) + '"></div>' +
        '<button class="btn btn-primary" type="submit">Guardar</button>' +
      '</form>' +

      '<div class="section-title"><h2>💾 Respaldo de datos</h2></div>' +
      '<div class="alert-box info">En esta versión de demostración los datos se guardan en este navegador. Descarga un respaldo periódicamente; con la base de datos real esto ya no será necesario.</div>' +
      '<div class="action-buttons-row">' +
        '<button class="btn btn-secondary" id="exportBtn">⬇️ Descargar respaldo</button>' +
        '<label class="btn btn-secondary" style="cursor:pointer">⬆️ Restaurar respaldo<input type="file" id="importFile" accept=".json" class="hidden"></label>' +
        '<button class="btn btn-danger" id="resetBtn">♻️ Restablecer datos de demostración</button>' +
      '</div>';

    document.getElementById('addGroomerBtn').addEventListener('click', () => groomerForm(null));
    app.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => groomerForm(b.getAttribute('data-edit'))));
    app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-del');
      if (data.visits.some(v => v.groomerId === id) || data.appointments.some(a => a.groomerId === id)) {
        UI.showToast('Tiene historial: márcalo como inactivo en vez de eliminarlo', 'danger');
        return;
      }
      if (confirm('¿Eliminar este groomer?')) DataService.groomers.remove(id).then(load);
    }));

    document.getElementById('bizForm').addEventListener('submit', e => {
      e.preventDefault();
      const phone = Util.normalizePhone(document.getElementById('bz_phone').value);
      if (phone.length < 12) { UI.showToast('Escribe el número con indicativo, ej: 573212678592', 'danger'); return; }
      DataService.saveSettings({ ownerName: document.getElementById('bz_owner').value.trim(), ownerPhone: phone }).then(() => { UI.showToast('Datos guardados', 'success'); load(); });
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      DataService.exportAll().then(dump => {
        const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'respaldo-venuspa-' + Util.today() + '.json';
        a.click();
        UI.logAction('Respaldo descargado', '');
      });
    });
    document.getElementById('importFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Esto reemplaza TODOS los datos actuales por los del respaldo. ¿Continuar?')) return;
      file.text().then(txt => DataService.importAll(JSON.parse(txt)))
        .then(() => { UI.showToast('Respaldo restaurado', 'success'); load(); })
        .catch(err => UI.showToast(err.message || 'Archivo no válido', 'danger'));
    });
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (confirm('Se borrarán los datos actuales y se cargarán los de demostración. ¿Continuar?')) {
        DataService.resetDemo().then(() => { UI.showToast('Datos de demostración restablecidos', 'success'); load(); });
      }
    });
  }

  function groomerForm(id) {
    const g = id ? data.groomers.find(x => x.id === id) : { name: '', commission: 0, active: true };
    UI.openModal(
      '<h2>' + (id ? '✏️ Editar groomer' : '✂️ Nuevo groomer') + '</h2>' +
      '<form id="grForm">' +
        '<div class="field"><label for="gr_name">Nombre</label><input id="gr_name" required value="' + UI.escapeHtml(g.name) + '"></div>' +
        '<div class="field"><label for="gr_com">Comisión (%)</label><input type="number" id="gr_com" min="0" max="100" value="' + g.commission + '"></div>' +
        '<label class="check-row"><input type="checkbox" id="gr_active"' + (g.active ? ' checked' : '') + '><span>Activo (aparece al agendar y registrar servicios)</span></label>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="gr_cancel">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>' +
      '</form>'
    );
    document.getElementById('gr_cancel').addEventListener('click', UI.closeModal);
    document.getElementById('grForm').addEventListener('submit', e => {
      e.preventDefault();
      const payload = { name: document.getElementById('gr_name').value.trim(), commission: Number(document.getElementById('gr_com').value) || 0, active: document.getElementById('gr_active').checked };
      (id ? DataService.groomers.update(id, payload) : DataService.groomers.add(payload)).then(() => {
        UI.logAction(id ? 'Groomer editado' : 'Groomer creado', payload.name);
        UI.showToast('Groomer guardado', 'success');
        UI.closeModal();
        load();
      });
    });
  }

  load();
});
