document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const app = document.getElementById('app');
  app.innerHTML =
    '<div class="toolbar">' +
      '<div class="search-bar" style="flex:1;min-width:240px;margin:0"><span class="search-icon">🔍</span>' +
        '<input type="search" id="searchInput" placeholder="Buscar por dueño, mascota, raza o WhatsApp..."></div>' +
      '<button class="btn btn-primary" id="newOwnerBtn">+ Nuevo cliente</button>' +
    '</div>' +
    '<div id="listWrap"></div>';

  const listWrap = document.getElementById('listWrap');
  let data = null;

  function load() {
    return DataService.all(['owners', 'pets', 'visits']).then(d => { data = d; render(); });
  }

  function render() {
    const q = Util.norm(document.getElementById('searchInput').value);
    const petsByOwner = {};
    data.pets.forEach(p => { (petsByOwner[p.ownerId] = petsByOwner[p.ownerId] || []).push(p); });

    const rows = data.owners
      .filter(o => {
        if (!q) return true;
        const pets = petsByOwner[o.id] || [];
        return Util.norm(o.name).includes(q) || Util.norm(o.whatsapp).includes(q) ||
          pets.some(p => Util.norm(p.name).includes(q) || Util.norm(p.breed).includes(q));
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!rows.length) {
      listWrap.innerHTML = UI.emptyState('🔍', q ? 'No se encontraron clientes con esa búsqueda.' : 'Todavía no hay clientes. Crea el primero.');
      return;
    }

    listWrap.innerHTML = UI.table(
      ['Dueño', 'WhatsApp', 'Mascotas', 'Última visita', 'Acciones'],
      rows.map(o => {
        const pets = petsByOwner[o.id] || [];
        const last = Logic.lastVisitOfOwner(data.visits, o.id);
        return {
          attrs: 'data-open="' + o.id + '" style="cursor:pointer"',
          cells: [
            '<strong>' + UI.escapeHtml(o.name) + '</strong>' + (o.consent ? '' : ' <span class="chip red">Sin autorización de datos</span>'),
            UI.escapeHtml(Util.formatPhone(o.whatsapp)),
            '<div class="avatar-stack">' + (pets.length ? pets.map(p => '<span class="pill">' + UI.petAvatar(p, 'sm') + UI.escapeHtml(p.name) + '</span>').join('') : '<span class="muted">—</span>') + '</div>',
            last ? Util.formatShort(last) + ' <span class="muted">(hace ' + Util.diffDays(last, Util.today()) + ' d)</span>' : '<span class="muted">Sin visitas</span>',
            '<div class="row-actions">' +
              '<button class="btn btn-secondary btn-sm" data-open="' + o.id + '">Ver ficha</button>' +
              '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + Util.waLink(o.whatsapp) + '" data-stop>WhatsApp</a>' +
            '</div>'
          ]
        };
      })
    );
  }

  listWrap.addEventListener('click', function (e) {
    if (e.target.closest('[data-stop]')) return;
    const row = e.target.closest('[data-open]');
    if (row) window.location.href = 'cliente.html?id=' + row.getAttribute('data-open');
  });

  document.getElementById('searchInput').addEventListener('input', () => render());
  document.getElementById('newOwnerBtn').addEventListener('click', () => {
    OwnerForm.open(null, owner => { window.location.href = 'cliente.html?id=' + owner.id; });
  });

  load();
});
