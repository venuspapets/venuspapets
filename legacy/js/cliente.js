document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const ownerId = new URLSearchParams(window.location.search).get('id');
  const app = document.getElementById('app');
  let data = null;
  let settings = null;
  let historyPetId = 'all';

  function load() {
    return Promise.all([
      DataService.all(['owners', 'pets', 'visits', 'groomers', 'packages', 'appointments', 'services']),
      DataService.getSettings()
    ]).then(r => { data = r[0]; settings = r[1]; render(); });
  }

  function render() {
    const owner = data.owners.find(o => o.id === ownerId);
    if (!owner) {
      app.innerHTML = UI.emptyState('🤔', 'No se encontró este cliente. <a href="clientes.html" style="color:var(--color-primary-dark)">Volver a la lista</a>');
      return;
    }
    const pets = data.pets.filter(p => p.ownerId === owner.id);
    const visits = data.visits.filter(v => v.ownerId === owner.id);
    const referrer = owner.referredBy ? data.owners.find(o => o.id === owner.referredBy) : null;
    const referred = data.owners.filter(o => o.referredBy === owner.id);
    const totalSpent = Util.sum(visits, v => v.total);

    app.innerHTML =
      '<div class="profile-head">' +
        '<div class="info">' +
          '<h2>' + UI.escapeHtml(owner.name) + '</h2>' +
          '<div class="meta">' +
            '<span>📱 ' + UI.escapeHtml(Util.formatPhone(owner.whatsapp)) + '</span>' +
            (owner.address ? '<span>📍 ' + UI.escapeHtml(owner.address) + '</span>' : '') +
            (owner.birthday ? '<span>🎂 ' + Util.formatShort(owner.birthday) + '</span>' : '') +
            '<span>🧾 ' + visits.length + ' visita(s) · ' + UI.formatCurrency(totalSpent) + '</span>' +
          '</div>' +
          '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
            (owner.consent
              ? '<span class="chip green">✔ Datos autorizados (Ley 1581)' + (owner.consentDate ? ' · ' + Util.formatShort(owner.consentDate) : '') + '</span>'
              : '<span class="chip red">Sin autorización de datos</span>') +
            (referrer ? '<span class="chip">Referido por ' + UI.escapeHtml(referrer.name) + '</span>' : '') +
            (referred.length ? '<span class="chip">Ha referido a ' + referred.length + '</span>' : '') +
          '</div>' +
          (owner.notes ? '<p class="muted" style="margin:8px 0 0;font-size:.85rem">📝 ' + UI.escapeHtml(owner.notes) + '</p>' : '') +
        '</div>' +
        '<div class="head-actions">' +
          '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + Util.waLink(owner.whatsapp) + '">WhatsApp</a>' +
          '<button class="btn btn-secondary" id="editOwnerBtn">✏️ Editar</button>' +
          '<button class="btn btn-danger" id="deleteOwnerBtn">🗑️</button>' +
        '</div>' +
      '</div>' +

      '<div class="section-title"><h2>Mascotas (' + pets.length + ')</h2>' +
        '<button class="btn btn-primary btn-sm" id="addPetBtn">+ Agregar mascota</button></div>' +
      (pets.length ? '<div class="pets-grid">' + pets.map(p => petCard(p)).join('') + '</div>' : UI.emptyState('🐾', 'Este cliente todavía no tiene mascotas registradas.')) +

      '<div class="section-title"><h2>Historial de visitas</h2>' +
        (pets.length > 1 ? '<select id="historyFilter" class="btn btn-secondary" style="padding:6px 10px"><option value="all">Todas las mascotas</option>' +
          pets.map(p => '<option value="' + p.id + '"' + (historyPetId === p.id ? ' selected' : '') + '>' + UI.escapeHtml(p.name) + '</option>').join('') + '</select>' : '') +
      '</div>' +
      '<div id="historyWrap"></div>';

    renderHistory(pets, visits);
    wire(owner, pets);
  }

  function petCard(p) {
    const info = Logic.loyaltyInfo(p.id, data.visits, settings);
    const last = Logic.lastVisitDate(data.visits, p.id);
    const pkg = data.packages.find(k => k.petId === p.id && k.remaining > 0);
    const vaccines = (p.vaccines || []).map(v => {
      const overdue = v.next && v.next < Util.today();
      return '<span class="chip ' + (overdue ? 'red' : 'green') + '" title="Próxima: ' + Util.formatShort(v.next) + '">' + UI.escapeHtml(v.name) + (v.next ? ' · ' + Util.formatShort(v.next) : '') + '</span>';
    }).join(' ');
    const bd = Util.daysUntilBirthday(p.birthdate);

    return '<div class="pet-card">' +
      '<div class="pet-card__top">' + UI.petAvatar(p, 'md') +
        '<div><h3>' + UI.escapeHtml(p.name) + '</h3><span>' + UI.escapeHtml(p.breed || 'Sin raza') + ' · ' + Logic.sizeLabel(p.size) + '</span></div></div>' +
      '<dl class="pet-facts">' +
        '<dt>Edad</dt><dd>' + Util.age(p.birthdate) + (bd !== null && bd <= 14 ? ' <span class="chip amber">🎂 en ' + bd + ' d</span>' : '') + '</dd>' +
        '<dt>Carácter</dt><dd>' + UI.escapeHtml(p.temperament || '—') + '</dd>' +
        '<dt>Alergias</dt><dd>' + (p.allergies ? '<span class="chip red">' + UI.escapeHtml(p.allergies) + '</span>' : '—') + '</dd>' +
        '<dt>Corte</dt><dd>' + UI.escapeHtml(p.preferredCut || '—') + '</dd>' +
        '<dt>Vacunas</dt><dd>' + (vaccines || '—') + '</dd>' +
        '<dt>Último baño</dt><dd>' + (last ? Util.formatShort(last) : 'Sin visitas') + ' · cada ' + (p.frequencyDays || 30) + ' d</dd>' +
        (p.notes ? '<dt>Notas</dt><dd>' + UI.escapeHtml(p.notes) + '</dd>' : '') +
      '</dl>' +
      '<div><div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--color-text-muted)">' +
        '<span>Fidelización: ' + info.inCycle + '/' + info.everyN + ' baños</span>' +
        '<span>' + (info.nextIsReward ? '🎁 ¡El próximo tiene descuento!' : 'Faltan ' + (info.remaining - 1) + ' para el premio') + '</span></div>' +
        '<div class="progress"><div style="width:' + Math.round(info.inCycle / info.everyN * 100) + '%"></div></div></div>' +
      (pkg ? '<span class="chip blue">📦 Paquete: ' + pkg.remaining + ' de ' + pkg.total + ' baños</span>' : '') +
      '<div class="pet-card__actions">' +
        '<button class="btn btn-primary btn-sm" data-service="' + p.id + '">🧾 Registrar servicio</button>' +
        '<a class="btn btn-secondary btn-sm" href="agenda.html?pet=' + p.id + '">📅 Agendar</a>' +
        '<button class="btn btn-secondary btn-sm" data-editpet="' + p.id + '">✏️</button>' +
        '<button class="btn btn-secondary btn-sm" data-delpet="' + p.id + '">🗑️</button>' +
      '</div>' +
    '</div>';
  }

  function renderHistory(pets, visits) {
    const wrap = document.getElementById('historyWrap');
    const petsById = Util.byId(pets);
    const groomers = Util.byId(data.groomers);
    const list = visits.filter(v => historyPetId === 'all' || v.petId === historyPetId)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

    if (!list.length) { wrap.innerHTML = UI.emptyState('🧾', 'Aún no hay visitas registradas.'); return; }

    wrap.innerHTML = UI.table(
      ['Fecha', 'Mascota', 'Servicios', 'Groomer', 'Pago', 'Total', 'Fotos'],
      list.map(v => ({
        cells: [
          Util.formatShort(v.date),
          UI.escapeHtml((petsById[v.petId] || {}).name || '—'),
          UI.escapeHtml(v.items.map(i => i.name).join(', ')) + (v.discountKey ? ' <span class="chip amber">-' + v.discountPct + '%</span>' : '') +
            (v.notes ? '<div class="muted" style="font-size:.78rem">' + UI.escapeHtml(v.notes) + '</div>' : ''),
          UI.escapeHtml((groomers[v.groomerId] || {}).name || '—'),
          Logic.payLabel(v.payMethod),
          '<strong>' + UI.formatCurrency(v.total) + '</strong>' + (v.tip ? '<div class="muted" style="font-size:.75rem">+ ' + UI.formatCurrency(v.tip) + ' propina</div>' : ''),
          '<div class="thumb-row">' +
            (v.beforePhoto ? '<img class="thumb" src="' + v.beforePhoto + '" data-photo="before:' + v.id + '" title="Antes">' : '') +
            (v.afterPhoto ? '<img class="thumb" src="' + v.afterPhoto + '" data-photo="after:' + v.id + '" title="Después">' : '') +
            (!v.beforePhoto && !v.afterPhoto ? '<span class="muted">—</span>' : '') + '</div>'
        ]
      }))
    );
    wrap.querySelectorAll('[data-photo]').forEach(img => {
      img.addEventListener('click', () => {
        const parts = img.getAttribute('data-photo').split(':');
        UI.showPhoto(img.src, (parts[0] === 'before' ? 'Antes' : 'Después') + ' — ' + Util.formatShort(visits.find(v => v.id === parts[1]).date));
      });
    });
  }

  /** Al eliminar una mascota se quitan sus citas y su lugar en la lista de espera. */
  function removePetLinks(petId) {
    const jobs = data.appointments.filter(a => a.petId === petId).map(a => DataService.appointments.remove(a.id));
    return DataService.waitlist.list().then(w => Promise.all(jobs.concat(w.filter(x => x.petId === petId).map(x => DataService.waitlist.remove(x.id)))));
  }

  function wire(owner, pets) {
    document.getElementById('editOwnerBtn').addEventListener('click', () => OwnerForm.open(owner.id, load));
    document.getElementById('deleteOwnerBtn').addEventListener('click', () => {
      if (data.visits.some(v => v.ownerId === owner.id)) {
        UI.showToast('Este cliente tiene historial de visitas y no se puede eliminar', 'danger');
        return;
      }
      if (confirm('¿Eliminar a ' + owner.name + ' y sus mascotas?')) {
        Promise.all(pets.map(p => removePetLinks(p.id).then(() => DataService.pets.remove(p.id))))
          .then(() => DataService.owners.remove(owner.id))
          .then(() => { UI.logAction('Cliente eliminado', owner.name); window.location.href = 'clientes.html'; });
      }
    });
    document.getElementById('addPetBtn').addEventListener('click', () => PetForm.open(null, owner.id, load));

    app.querySelectorAll('[data-editpet]').forEach(b => b.addEventListener('click', () => PetForm.open(b.getAttribute('data-editpet'), owner.id, load)));
    app.querySelectorAll('[data-service]').forEach(b => b.addEventListener('click', () => VisitForm.open({ petId: b.getAttribute('data-service'), onSaved: load })));
    app.querySelectorAll('[data-delpet]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-delpet');
      const pet = data.pets.find(p => p.id === id);
      if (data.visits.some(v => v.petId === id)) { UI.showToast('Esta mascota tiene historial y no se puede eliminar', 'danger'); return; }
      if (confirm('¿Eliminar a ' + pet.name + '?')) {
        removePetLinks(id).then(() => DataService.pets.remove(id)).then(() => { UI.logAction('Mascota eliminada', pet.name); load(); });
      }
    }));

    const filter = document.getElementById('historyFilter');
    if (filter) filter.addEventListener('change', () => {
      historyPetId = filter.value;
      renderHistory(pets, data.visits.filter(v => v.ownerId === owner.id));
    });
  }

  load();
});
