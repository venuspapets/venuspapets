document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const app = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);

  const state = { view: 'day', date: Util.today(), groomer: 'all' };
  let data = null;
  let settings = null;

  function load() {
    return Promise.all([
      DataService.all(['appointments', 'pets', 'owners', 'services', 'groomers', 'waitlist']),
      DataService.getSettings()
    ]).then(r => { data = r[0]; settings = r[1]; render(); });
  }

  function lookup() {
    return { pets: Util.byId(data.pets), owners: Util.byId(data.owners), services: Util.byId(data.services), groomers: Util.byId(data.groomers) };
  }

  function serviceNames(appt) {
    const s = Util.byId(data.services);
    return appt.serviceIds.map(id => (s[id] || {}).name).filter(Boolean).join(', ') || 'Sin servicios';
  }

  /* ------------------------------ Render ------------------------------ */

  function render() {
    app.innerHTML =
      '<div class="agenda-toolbar">' +
        '<button class="btn btn-secondary btn-sm" id="prevBtn">◀</button>' +
        '<button class="btn btn-secondary btn-sm" id="todayBtn">Hoy</button>' +
        '<button class="btn btn-secondary btn-sm" id="nextBtn">▶</button>' +
        '<div class="date-label">' + dateLabel() + '</div>' +
        '<input type="date" id="datePick" value="' + state.date + '">' +
        '<select id="viewSel"><option value="day"' + (state.view === 'day' ? ' selected' : '') + '>Vista diaria</option><option value="week"' + (state.view === 'week' ? ' selected' : '') + '>Vista semanal</option></select>' +
        '<select id="groomerSel"><option value="all">Todos los groomers</option>' +
          data.groomers.filter(g => g.active).map(g => '<option value="' + g.id + '"' + (state.groomer === g.id ? ' selected' : '') + '>' + UI.escapeHtml(g.name) + '</option>').join('') + '</select>' +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-primary" id="newApptBtn">+ Nueva cita</button>' +
      '</div>' +
      (state.view === 'day' ? dayView() : weekView()) +
      waitlistSection();
    wire();
  }

  function dateLabel() {
    if (state.view === 'day') {
      const long = Util.formatLong(state.date);
      return long.charAt(0).toUpperCase() + long.slice(1) + (state.date === Util.today() ? ' (hoy)' : '');
    }
    const start = Util.startOfWeek(state.date);
    return 'Semana del ' + Util.formatShort(start) + ' al ' + Util.formatShort(Util.addDays(start, 6));
  }

  function apptsOf(date) {
    return data.appointments
      .filter(a => a.date === date && (state.groomer === 'all' || a.groomerId === state.groomer))
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }

  function dayView() {
    const list = apptsOf(state.date);
    if (!list.length) return UI.emptyState('📅', 'No hay citas para este día.');
    const L = lookup();
    const active = list.filter(a => a.status === 'agendada').length;
    return '<p class="muted" style="margin:0 0 12px">' + list.length + ' cita(s) · ' + active + ' pendiente(s)</p>' +
      '<div class="appt-list">' + list.map(a => apptCard(a, L)).join('') + '</div>';
  }

  function apptCard(a, L) {
    const pet = L.pets[a.petId] || { name: '—' };
    const owner = L.owners[a.ownerId] || { name: '—', whatsapp: '' };
    const groomer = L.groomers[a.groomerId];
    const names = serviceNames(a);
    return '<div class="appt-card st-' + a.status + '">' +
      '<div class="appt-time">' + Util.formatTime(a.time) + '<small>hasta ' + Util.formatTime(Util.addMinutes(a.time, a.duration)) + '</small></div>' +
      UI.petAvatar(pet, 'md') +
      '<div class="appt-main"><strong>' + UI.escapeHtml(pet.name) + ' <span class="muted" style="font-weight:400">· ' + UI.escapeHtml(pet.breed || '') + '</span></strong>' +
        '<span>' + UI.escapeHtml(owner.name) + ' · ' + UI.escapeHtml(names) + '</span><br>' +
        '<span>✂️ ' + UI.escapeHtml(groomer ? groomer.name : 'Sin asignar') + (a.notes ? ' · 📝 ' + UI.escapeHtml(a.notes) : '') + '</span></div>' +
      '<span class="status-pill ' + a.status + '">' + Logic.statusLabel(a.status) + '</span>' +
      '<div class="appt-actions">' +
        (a.status === 'agendada' ? '<button class="btn btn-success btn-sm" data-attend="' + a.id + '">✔ Atender</button>' : '') +
        '<select data-status="' + a.id + '" title="Cambiar estado">' + Logic.STATUSES.map(s => '<option value="' + s.key + '"' + (a.status === s.key ? ' selected' : '') + '>' + s.label + '</option>').join('') + '</select>' +
        '<button class="btn btn-secondary btn-sm" data-share="' + a.id + '" title="Recordatorio / Calendar">🔔</button>' +
        '<button class="btn btn-secondary btn-sm" data-edit="' + a.id + '">✏️</button>' +
        '<button class="btn btn-secondary btn-sm" data-del="' + a.id + '">🗑️</button>' +
      '</div></div>';
  }

  function weekView() {
    const start = Util.startOfWeek(state.date);
    const L = lookup();
    let html = '<div class="week-grid">';
    for (let i = 0; i < 7; i++) {
      const day = Util.addDays(start, i);
      const list = apptsOf(day);
      html += '<div class="week-col' + (day === Util.today() ? ' today' : '') + '">' +
        '<header data-goday="' + day + '"><span>' + Util.weekdayName(day) + ' ' + Number(day.slice(8)) + '</span><span class="muted">' + list.filter(a => a.status === 'agendada').length + '</span></header>' +
        (list.length ? list.map(a => {
          const pet = L.pets[a.petId] || { name: '—' };
          return '<div class="week-item st-' + a.status + '" data-goday="' + day + '"><b>' + Util.formatTime(a.time) + ' · ' + UI.escapeHtml(pet.name) + '</b>' +
            '<span class="muted">' + UI.escapeHtml(serviceNames(a)) + '</span></div>';
        }).join('') : '<div class="week-item muted">Libre</div>') +
      '</div>';
    }
    return html + '</div>';
  }

  function waitlistSection() {
    const L = lookup();
    const items = data.waitlist.slice().sort((a, b) => (a.preferredDate || '9') < (b.preferredDate || '9') ? -1 : 1);
    return '<div class="section-title"><h2>⏳ Lista de espera (' + items.length + ')</h2><button class="btn btn-secondary btn-sm" id="addWaitBtn">+ Agregar</button></div>' +
      (items.length ? UI.table(['Cliente / mascota', 'Contacto', 'Prefiere', 'Nota', 'Acciones'], items.map(w => ({
        cells: [
          '<strong>' + UI.escapeHtml(w.petId && L.pets[w.petId] ? L.pets[w.petId].name : w.name) + '</strong>' + (w.petId && L.pets[w.petId] ? '<div class="muted" style="font-size:.78rem">' + UI.escapeHtml((L.owners[L.pets[w.petId].ownerId] || {}).name || '') + '</div>' : ''),
          UI.escapeHtml(Util.formatPhone(w.phone)),
          w.preferredDate ? Util.formatShort(w.preferredDate) : '—',
          '<span class="desc-cell">' + UI.escapeHtml(w.note || '—') + '</span>',
          '<div class="row-actions">' +
            '<button class="btn btn-primary btn-sm" data-wschedule="' + w.id + '">Agendar</button>' +
            (w.phone ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + Util.waLink(w.phone, 'Hola 🐶, se liberó un cupo en ' + settings.businessName + '. ¿Te sirve agendar?') + '">WhatsApp</a>' : '') +
            '<button class="btn btn-secondary btn-sm" data-wdel="' + w.id + '">🗑️</button></div>'
        ]
      }))) : '<p class="muted">No hay nadie en espera.</p>');
  }

  /* ------------------------------ Eventos ------------------------------ */

  function wire() {
    const $ = id => document.getElementById(id);
    const shift = n => { state.date = Util.addDays(state.date, state.view === 'day' ? n : n * 7); render(); };
    $('prevBtn').addEventListener('click', () => shift(-1));
    $('nextBtn').addEventListener('click', () => shift(1));
    $('todayBtn').addEventListener('click', () => { state.date = Util.today(); render(); });
    $('datePick').addEventListener('change', e => { if (e.target.value) { state.date = e.target.value; render(); } });
    $('viewSel').addEventListener('change', e => { state.view = e.target.value; render(); });
    $('groomerSel').addEventListener('change', e => { state.groomer = e.target.value; render(); });
    $('newApptBtn').addEventListener('click', () => apptForm({ date: state.date }));
    $('addWaitBtn').addEventListener('click', waitForm);

    app.querySelectorAll('[data-goday]').forEach(el => el.addEventListener('click', () => { state.date = el.getAttribute('data-goday'); state.view = 'day'; render(); }));
    app.querySelectorAll('[data-attend]').forEach(b => b.addEventListener('click', () => VisitForm.open({ appointmentId: b.getAttribute('data-attend'), onSaved: load })));
    app.querySelectorAll('[data-status]').forEach(s => s.addEventListener('change', () => {
      const appt = data.appointments.find(x => x.id === s.getAttribute('data-status'));
      // Marcar como atendida requiere registrar el servicio, para que entre a la caja.
      if (s.value === 'atendida' && !appt.visitId) { VisitForm.open({ appointmentId: appt.id, onSaved: load }); s.value = appt.status; return; }
      DataService.appointments.update(s.getAttribute('data-status'), { status: s.value }).then(() => {
        UI.logAction('Estado de cita cambiado', Logic.statusLabel(s.value));
        UI.showToast('Estado actualizado', 'success');
        load();
      });
    }));
    app.querySelectorAll('[data-share]').forEach(b => b.addEventListener('click', () => shareModal(data.appointments.find(a => a.id === b.getAttribute('data-share')))));
    app.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => apptForm({ apptId: b.getAttribute('data-edit') })));
    app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      if (confirm('¿Eliminar esta cita?')) DataService.appointments.remove(b.getAttribute('data-del')).then(() => { UI.showToast('Cita eliminada', 'success'); load(); });
    }));
    app.querySelectorAll('[data-wdel]').forEach(b => b.addEventListener('click', () => DataService.waitlist.remove(b.getAttribute('data-wdel')).then(load)));
    app.querySelectorAll('[data-wschedule]').forEach(b => b.addEventListener('click', () => {
      const w = data.waitlist.find(x => x.id === b.getAttribute('data-wschedule'));
      apptForm({ petId: w.petId, date: w.preferredDate || state.date, fromWaitId: w.id });
    }));
  }

  /* ------------------------------ Compartir: Calendar y WhatsApp ------------------------------ */

  function shareModal(appt) {
    const L = lookup();
    const pet = L.pets[appt.petId];
    const owner = L.owners[appt.ownerId];
    const names = serviceNames(appt);
    const gcal = Logic.googleCalendarUrl(appt, pet, owner, names, settings);
    const toClient = Util.waLink(owner.whatsapp, Logic.Messages.appointment(owner, pet, appt, settings));
    const toOwner = Util.waLink(settings.ownerPhone, Logic.Messages.ownerNewAppointment(owner, pet, appt, names));

    UI.openModal(
      '<h2>🔔 Recordatorios de la cita</h2>' +
      '<p class="modal-subtitle">' + UI.escapeHtml(pet.name) + ' · ' + Util.formatLong(appt.date) + ' a las ' + Util.formatTime(appt.time) + '</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<a class="btn btn-primary btn-block" target="_blank" rel="noopener" href="' + gcal + '">📆 Agregar a Google Calendar (' + UI.escapeHtml(settings.ownerName) + ')</a>' +
        '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + toClient + '">💬 Recordar al cliente por WhatsApp</a>' +
        '<a class="btn btn-secondary btn-block" target="_blank" rel="noopener" href="' + toOwner + '">📲 Avisar a ' + UI.escapeHtml(settings.ownerName) + ' por WhatsApp</a>' +
      '</div>' +
      '<div class="field-hint" style="margin-top:12px">Google Calendar avisa en el celular de ' + UI.escapeHtml(settings.ownerName) + ' antes de cada cita. Puedes ajustar la alerta en Calendar.</div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="shareClose">Cerrar</button></div>'
    );
    document.getElementById('shareClose').addEventListener('click', UI.closeModal);
  }

  /* ------------------------------ Formulario de cita ------------------------------ */

  function toMin(hhmm) { const p = hhmm.split(':').map(Number); return p[0] * 60 + p[1]; }

  function apptForm(opts) {
    const appt = opts.apptId ? data.appointments.find(a => a.id === opts.apptId) : null;
    const pets = data.pets.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!pets.length) { UI.showToast('Primero registra una mascota', 'danger'); return; }
    const owners = Util.byId(data.owners);
    const services = data.services.filter(s => s.active);
    const groomers = data.groomers.filter(g => g.active);

    const a = appt || { petId: opts.petId || pets[0].id, date: opts.date || Util.today(), time: '09:00', duration: 60, serviceIds: [], groomerId: groomers[0] ? groomers[0].id : '', notes: '' };
    const selected = new Set(a.serviceIds);
    let durationTouched = !!appt;

    UI.openModal(
      '<h2>' + (appt ? '✏️ Editar cita' : '📅 Nueva cita') + '</h2>' +
      '<form id="apptForm">' +
        '<div class="field"><label for="af_pet">Mascota</label><select id="af_pet">' +
          pets.map(p => '<option value="' + p.id + '"' + (p.id === a.petId ? ' selected' : '') + '>' + UI.escapeHtml(p.name) + ' — ' + UI.escapeHtml((owners[p.ownerId] || {}).name || '') + '</option>').join('') + '</select></div>' +
        '<div class="form-grid-3">' +
          '<div class="field"><label for="af_date">Fecha</label><input type="date" id="af_date" value="' + a.date + '" required></div>' +
          '<div class="field"><label for="af_time">Hora</label><input type="time" id="af_time" value="' + a.time + '" required></div>' +
          '<div class="field"><label for="af_groomer">Groomer</label><select id="af_groomer">' +
            groomers.map(g => '<option value="' + g.id + '"' + (g.id === a.groomerId ? ' selected' : '') + '>' + UI.escapeHtml(g.name) + '</option>').join('') + '</select></div>' +
        '</div>' +
        '<div class="field"><label>Servicios</label><div class="service-pick" id="af_services"></div></div>' +
        '<div class="field"><label for="af_duration">Duración (minutos)</label><input type="number" id="af_duration" min="5" step="1" value="' + a.duration + '">' +
          '<div class="field-hint" id="af_durHint">Se calcula según el tamaño de la mascota y los servicios.</div></div>' +
        '<div class="field"><label for="af_notes">Notas</label><textarea id="af_notes">' + UI.escapeHtml(a.notes || '') + '</textarea></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="af_cancel">Cancelar</button><button type="submit" class="btn btn-primary">Guardar cita</button></div>' +
      '</form>',
      { wide: true, closeOnOverlay: false }
    );

    const $ = id => document.getElementById(id);
    const pet = () => data.pets.find(p => p.id === $('af_pet').value);
    UI.enhanceSelect($('af_pet'));

    function renderServices() {
      const p = pet();
      const group = (title, type) => {
        const list = services.filter(s => s.type === type);
        return list.length ? '<div class="group-title">' + title + '</div>' + list.map(s =>
          '<label><span><input type="checkbox" data-svc="' + s.id + '"' + (selected.has(s.id) ? ' checked' : '') + '> ' + UI.escapeHtml(s.name) + '</span>' +
          '<span class="price">' + UI.formatCurrency(Logic.priceFor(s, p)) + '</span></label>').join('') : '';
      };
      $('af_services').innerHTML = group('Servicios principales', 'base') + group('Adicionales', 'adicional');
    }

    function recalcDuration() {
      if (durationTouched) return;
      const chosen = services.filter(s => selected.has(s.id));
      $('af_duration').value = Logic.durationFor(pet(), chosen, settings);
    }

    renderServices();
    recalcDuration();

    $('af_pet').addEventListener('change', () => { renderServices(); recalcDuration(); });
    $('af_services').addEventListener('change', e => {
      const id = e.target.getAttribute('data-svc');
      if (!id) return;
      if (e.target.checked) selected.add(id); else selected.delete(id);
      recalcDuration();
    });
    $('af_duration').addEventListener('input', () => { durationTouched = true; });
    $('af_cancel').addEventListener('click', UI.closeModal);

    $('apptForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!selected.size) { UI.showToast('Selecciona al menos un servicio', 'danger'); return; }
      const p = pet();
      const payload = {
        petId: p.id, ownerId: p.ownerId, date: $('af_date').value, time: $('af_time').value,
        duration: Number($('af_duration').value) || 60, serviceIds: Array.from(selected),
        groomerId: $('af_groomer').value, notes: $('af_notes').value.trim()
      };

      const start = toMin(payload.time);
      const end = start + payload.duration;
      const clash = data.appointments.find(x =>
        (!appt || x.id !== appt.id) && x.date === payload.date && x.groomerId === payload.groomerId &&
        (x.status === 'agendada' || x.status === 'atendida') &&
        start < toMin(x.time) + x.duration && end > toMin(x.time));
      if (clash) {
        const cp = (Util.byId(data.pets)[clash.petId] || {}).name;
        if (!confirm('Este groomer ya tiene una cita que se cruza (' + cp + ' a las ' + Util.formatTime(clash.time) + '). ¿Agendar de todas formas?')) return;
      }

      const job = appt
        ? DataService.appointments.update(appt.id, payload)
        : DataService.appointments.add(Object.assign({ status: 'agendada', visitId: null }, payload));
      job.then(saved => {
        UI.logAction(appt ? 'Cita editada' : 'Cita agendada', p.name + ' — ' + Util.formatShort(saved.date) + ' ' + saved.time);
        UI.closeModal();
        const finish = () => load().then(() => {
          state.date = saved.date;
          render();
          if (!appt) shareModal(saved);
          else UI.showToast('Cita actualizada', 'success');
        });
        if (opts.fromWaitId) DataService.waitlist.remove(opts.fromWaitId).then(finish); else finish();
      });
    });
  }

  function waitForm() {
    const pets = data.pets.slice().sort((a, b) => a.name.localeCompare(b.name));
    const owners = Util.byId(data.owners);
    UI.openModal(
      '<h2>⏳ Agregar a lista de espera</h2>' +
      '<form id="waitForm">' +
        '<div class="field"><label for="wf_pet">Mascota registrada (opcional)</label><select id="wf_pet"><option value="">— Escribir nombre a mano —</option>' +
          pets.map(p => '<option value="' + p.id + '">' + UI.escapeHtml(p.name) + ' — ' + UI.escapeHtml((owners[p.ownerId] || {}).name || '') + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="wf_name">Nombre (si no está registrada)</label><input id="wf_name"></div>' +
        '<div class="form-grid-2">' +
          '<div class="field"><label for="wf_phone">WhatsApp</label><input id="wf_phone" type="tel"></div>' +
          '<div class="field"><label for="wf_date">Fecha preferida</label><input id="wf_date" type="date"></div>' +
        '</div>' +
        '<div class="field"><label for="wf_note">Nota</label><input id="wf_note" placeholder="Ej: prefiere en la mañana"></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="wf_cancel">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>' +
      '</form>'
    );
    const $ = id => document.getElementById(id);
    UI.enhanceSelect($('wf_pet'));
    $('wf_cancel').addEventListener('click', UI.closeModal);
    $('waitForm').addEventListener('submit', e => {
      e.preventDefault();
      const petId = $('wf_pet').value || null;
      const pet = petId ? data.pets.find(p => p.id === petId) : null;
      const name = pet ? pet.name : $('wf_name').value.trim();
      if (!name) { UI.showToast('Indica la mascota o escribe un nombre', 'danger'); return; }
      const phone = $('wf_phone').value.trim() || (pet && owners[pet.ownerId] ? owners[pet.ownerId].whatsapp : '');
      DataService.waitlist.add({ petId, name, phone, preferredDate: $('wf_date').value, note: $('wf_note').value.trim() }).then(() => {
        UI.showToast('Agregado a la lista de espera', 'success');
        UI.closeModal();
        load();
      });
    });
  }

  load().then(() => {
    const petParam = params.get('pet');
    if (petParam && data.pets.some(p => p.id === petParam)) apptForm({ petId: petParam, date: state.date });
  });
});
