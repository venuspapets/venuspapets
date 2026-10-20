document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAuth();

  const isAdmin = AUTH.isAdmin();

  const MODULES = [
    { href: 'clientes.html', icon: '🐶', title: 'Clientes y Mascotas', text: 'Fichas de dueños y mascotas, con foto, cuidados especiales e historial de visitas.' },
    { href: 'agenda.html', icon: '📅', title: 'Agenda de citas', text: 'Calendario diario y semanal, estados, groomer asignado y lista de espera.' },
    { href: 'caja.html', icon: '💵', title: 'Servicios del día y caja', text: 'Registra servicios, adicionales, propinas y métodos de pago. Cierre de caja.' },
    { href: 'recordatorios.html', icon: '🔔', title: 'Recordatorios', text: 'Citas de mañana, “ya toca el baño”, cumpleaños, vacunas y clientes por reactivar.' },
    { href: 'fidelizacion.html', icon: '🎁', title: 'Fidelización', text: 'Descuento en el 5.º baño, cumpleaños, referidos y paquetes prepagados.' },
    { href: 'inventario.html', icon: '🧴', title: 'Productos e insumos', text: 'Compras de champú y perfumes, duración, costo por servicio y stock bajo.' },
    { href: 'servicios.html', icon: '✂️', title: 'Catálogo de servicios', text: 'Servicios y precios por tamaño o por raza.', admin: true },
    { href: 'gastos.html', icon: '📉', title: 'Gastos y utilidad', text: 'Arriendo, servicios, sueldos y utilidad real del negocio.', admin: true },
    { href: 'reportes.html', icon: '📊', title: 'Reportes', text: 'Diario, semanal y mensual. Exporta a Excel o PDF.', admin: true },
    { href: 'equipo.html', icon: '👥', title: 'Equipo y respaldo', text: 'Groomers con comisión, usuarios y copia de seguridad.', admin: true },
    { href: 'actividad.html', icon: '📋', title: 'Registro de Actividad', text: 'Consulta las acciones realizadas por cada usuario del sistema.', admin: true }
  ];

  const grid = document.getElementById('modulesGrid');
  grid.innerHTML = MODULES.filter(m => isAdmin || !m.admin).map(m =>
    '<div class="module-card' + (m.admin ? ' admin-only' : '') + '" tabindex="0" data-href="' + m.href + '">' +
      '<div class="module-card__icon">' + m.icon + '</div>' +
      '<h2>' + m.title + '</h2>' +
      '<p>' + m.text + '</p>' +
    '</div>'
  ).join('');

  grid.querySelectorAll('.module-card').forEach(card => {
    const go = () => { window.location.href = card.getAttribute('data-href'); };
    card.addEventListener('click', go);
    card.addEventListener('keypress', e => { if (e.key === 'Enter') go(); });
  });

  // Resumen del día
  DataService.all(['appointments', 'visits', 'pets', 'owners', 'lots', 'products', 'packages']).then(function (d) {
    const today = Util.today();
    const tomorrow = Util.addDays(today, 1);
    const apptsToday = d.appointments.filter(a => a.date === today && a.status === 'agendada').length;
    const apptsTomorrow = d.appointments.filter(a => a.date === tomorrow && a.status === 'agendada').length;
    const visitsToday = d.visits.filter(v => v.date === today);
    const lowStock = d.products.filter(p => d.lots.filter(l => l.productId === p.id && !l.finishedDate).length <= p.minStock).length;

    const cards = [
      '<div class="stat-card stat-neutral"><span>Citas pendientes hoy</span><strong>' + apptsToday + '</strong></div>',
      '<div class="stat-card stat-neutral"><span>Citas de mañana</span><strong>' + apptsTomorrow + '</strong></div>',
      '<div class="stat-card stat-venta"><span>Servicios realizados hoy</span><strong>' + visitsToday.length + '</strong></div>'
    ];
    if (isAdmin) {
      cards.push('<div class="stat-card stat-balance"><span>Ingresos de hoy</span><strong>' + Util.currency(Util.sum(visitsToday, v => v.total)) + '</strong></div>');
    }
    cards.push('<div class="stat-card stat-warn"><span>Insumos con stock bajo</span><strong>' + lowStock + '</strong></div>');
    document.getElementById('todayStats').innerHTML = cards.join('');
  });
});
