document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const app = document.getElementById('app');
  const TABS = [
    { key: 'tomorrow', label: '📅 Citas de mañana' },
    { key: 'due', label: '🛁 Ya toca el baño' },
    { key: 'birthday', label: '🎂 Cumpleaños' },
    { key: 'vaccine', label: '💉 Vacunas' },
    { key: 'react30', label: '💤 Sin venir 30+ días' },
    { key: 'react60', label: '😴 Sin venir 60+ días' }
  ];
  let tab = 'tomorrow';
  let data = null;
  let settings = null;
  let lists = {};

  function load() {
    return Promise.all([DataService.all(['appointments', 'pets', 'owners', 'visits', 'reminders', 'services']), DataService.getSettings()])
      .then(r => { data = r[0]; settings = r[1]; build(); render(); });
  }

  function isSent(key) { return data.reminders.some(r => r.key === key); }

  function build() {
    const today = Util.today();
    const tomorrow = Util.addDays(today, 1);
    const owners = Util.byId(data.owners);
    const pets = Util.byId(data.pets);
    const [d1, d2] = settings.inactiveDays;
    const L = settings.loyalty;
    lists = { tomorrow: [], due: [], birthday: [], vaccine: [], react30: [], react60: [] };

    // Citas de mañana
    data.appointments.filter(a => a.date === tomorrow && a.status === 'agendada').sort((a, b) => (a.time < b.time ? -1 : 1)).forEach(a => {
      const pet = pets[a.petId]; const owner = owners[a.ownerId];
      if (!pet || !owner) return;
      lists.tomorrow.push({ key: 'appt:' + a.id, phone: owner.whatsapp, text: Logic.Messages.appointment(owner, pet, a, settings),
        title: UI.escapeHtml(pet.name) + ' · ' + Util.formatTime(a.time), sub: UI.escapeHtml(owner.name) });
    });

    // Último baño por mascota y por dueño
    const ownerLast = {};
    data.owners.forEach(o => { ownerLast[o.id] = Logic.lastVisitOfOwner(data.visits, o.id); });
    const ownerInactive = id => ownerLast[id] && Util.diffDays(ownerLast[id], today) >= d1;

    // Ya toca el baño
    data.pets.forEach(p => {
      const last = Logic.lastVisitDate(data.visits, p.id);
      const owner = owners[p.ownerId];
      if (!last || !owner || ownerInactive(owner.id)) return;
      const days = Util.diffDays(last, today);
      const hasFuture = data.appointments.some(a => a.petId === p.id && a.status === 'agendada' && a.date >= today);
      if (days >= (p.frequencyDays || 30) && !hasFuture) {
        lists.due.push({ key: 'due:' + p.id + ':' + last, phone: owner.whatsapp, text: Logic.Messages.dueBath(owner, p, days, settings), sort: -days,
          title: UI.escapeHtml(p.name) + ' · hace ' + days + ' días', sub: UI.escapeHtml(owner.name) + ' · toca cada ' + (p.frequencyDays || 30) + ' d' });
      }
    });
    lists.due.sort((a, b) => a.sort - b.sort);

    // Cumpleaños (mascotas y dueños) en los próximos 7 días
    const year = today.slice(0, 4);
    const when = n => (n === 0 ? '¡hoy!' : n === 1 ? 'mañana' : 'en ' + n + ' días');
    data.pets.forEach(p => {
      const n = Util.daysUntilBirthday(p.birthdate);
      const owner = owners[p.ownerId];
      if (n !== null && n <= 7 && owner) {
        lists.birthday.push({ key: 'bday-pet:' + p.id + ':' + year, phone: owner.whatsapp, text: Logic.Messages.petBirthday(owner, p, settings, L.birthdayPct), sort: n,
          title: '🐶 ' + UI.escapeHtml(p.name) + ' cumple ' + when(n), sub: UI.escapeHtml(owner.name) + ' · ofrece ' + L.birthdayPct + '% de descuento' });
      }
    });
    data.owners.forEach(o => {
      const n = Util.daysUntilBirthday(o.birthday);
      if (n !== null && n <= 7) {
        lists.birthday.push({ key: 'bday-owner:' + o.id + ':' + year, phone: o.whatsapp, text: Logic.Messages.ownerBirthday(o, settings), sort: n,
          title: '🙋 ' + UI.escapeHtml(o.name) + ' cumple ' + when(n), sub: 'Dueño/a de ' + UI.escapeHtml(data.pets.filter(p => p.ownerId === o.id).map(p => p.name).join(', ') || '—') });
      }
    });
    lists.birthday.sort((a, b) => a.sort - b.sort);

    // Vacunas por vencer (15 días) o vencidas
    data.pets.forEach(p => {
      const owner = owners[p.ownerId];
      (p.vaccines || []).forEach(v => {
        if (!v.next || !owner) return;
        const left = Util.diffDays(today, v.next);
        if (left <= 15) {
          lists.vaccine.push({ key: 'vac:' + p.id + ':' + v.name + ':' + v.next, phone: owner.whatsapp, text: Logic.Messages.vaccine(owner, p, v, settings), sort: left,
            title: UI.escapeHtml(p.name) + ' · ' + UI.escapeHtml(v.name) + (left < 0 ? ' <span class="chip red">vencida hace ' + (-left) + ' d</span>' : ' <span class="chip amber">vence en ' + left + ' d</span>'),
            sub: UI.escapeHtml(owner.name) });
        }
      });
    });
    lists.vaccine.sort((a, b) => a.sort - b.sort);

    // Reactivación por dueño
    data.owners.forEach(o => {
      const last = ownerLast[o.id];
      if (!last) return;
      const days = Util.diffDays(last, today);
      if (days < d1) return;
      const pet = data.pets.find(p => p.ownerId === o.id);
      if (!pet) return;
      const item = { key: 'react:' + o.id + ':' + last, phone: o.whatsapp, text: Logic.Messages.reactivation(o, pet, days, settings), sort: -days,
        title: UI.escapeHtml(o.name) + ' · ' + days + ' días sin venir', sub: 'Mascota(s): ' + UI.escapeHtml(data.pets.filter(p => p.ownerId === o.id).map(p => p.name).join(', ')) + ' · último: ' + Util.formatShort(last) };
      (days >= d2 ? lists.react60 : lists.react30).push(item);
    });
    lists.react30.sort((a, b) => a.sort - b.sort);
    lists.react60.sort((a, b) => a.sort - b.sort);
  }

  function render() {
    const tomorrow = Util.addDays(Util.today(), 1);
    app.innerHTML =
      '<div class="alert-box info no-print"><strong>¿Cómo funciona?</strong> Cada botón abre WhatsApp con el mensaje ya escrito; solo presionas enviar. Al hacer clic queda marcado como enviado.</div>' +
      '<div class="section-title" style="margin-top:0"><h2>📲 Agenda para ' + UI.escapeHtml(settings.ownerName) + '</h2></div>' +
      '<div class="action-buttons-row">' +
        '<a class="btn btn-wa btn-feature" target="_blank" rel="noopener" id="ownerToday">Agenda de hoy por WhatsApp</a>' +
        '<a class="btn btn-wa btn-feature" target="_blank" rel="noopener" id="ownerTomorrow">Agenda de mañana por WhatsApp</a>' +
      '</div>' +
      '<div class="tabs">' + TABS.map(t => {
        const pending = lists[t.key].filter(i => !isSent(i.key)).length;
        return '<button class="tab-btn' + (t.key === tab ? ' active' : '') + '" data-tab="' + t.key + '">' + t.label + '<span class="count">' + pending + '</span></button>';
      }).join('') + '</div>' +
      '<div id="remList"></div>';

    const agendaLink = (id, date) => {
      const items = data.appointments.filter(a => a.date === date && a.status === 'agendada').sort((a, b) => (a.time < b.time ? -1 : 1)).map(a => {
        const pet = data.pets.find(p => p.id === a.petId); const owner = data.owners.find(o => o.id === a.ownerId);
        const names = a.serviceIds.map(sid => (data.services.find(s => s.id === sid) || {}).name).filter(Boolean).join(', ');
        return { appt: a, pet, owner, serviceNames: names };
      }).filter(i => i.pet && i.owner);
      document.getElementById(id).href = Util.waLink(settings.ownerPhone, Logic.Messages.ownerAgenda(items, date, settings));
    };
    agendaLink('ownerToday', Util.today());
    agendaLink('ownerTomorrow', tomorrow);

    const list = lists[tab];
    document.getElementById('remList').innerHTML = list.length
      ? UI.table(['Cliente / mascota', 'Mensaje', 'Acción'], list.map(i => {
          const sent = data.reminders.find(r => r.key === i.key);
          return { cells: [
            '<strong>' + i.title + '</strong><div class="muted" style="font-size:.8rem">' + i.sub + '</div>',
            '<div class="reminder-msg">' + UI.escapeHtml(i.text) + '</div>',
            '<div class="row-actions"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" data-send="' + i.key + '" href="' + Util.waLink(i.phone, i.text) + '">' + (sent ? 'Reenviar' : 'Enviar por WhatsApp') + '</a>' +
            (sent ? '<span class="sent-tag">✔ Enviado ' + new Date(sent.sentAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + '</span>' : '') + '</div>'
          ] };
        }))
      : UI.emptyState('🎉', 'No hay recordatorios pendientes en esta categoría.');

    app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.getAttribute('data-tab'); render(); }));
    app.querySelectorAll('[data-send]').forEach(a => a.addEventListener('click', () => {
      const key = a.getAttribute('data-send');
      if (isSent(key)) return;
      DataService.reminders.add({ key, sentAt: Date.now() }).then(() => {
        UI.logAction('Recordatorio enviado', key.split(':')[0]);
        load();
      });
    }));
  }

  load();
});
