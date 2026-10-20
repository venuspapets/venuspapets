document.addEventListener('DOMContentLoaded', function () {
  AUTH.requireAdmin();

  const wrap = document.getElementById('app');

  function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  DataService.getActivityLog().then(log => {
    if (log.length === 0) {
      wrap.innerHTML = UI.emptyState('📋', 'Todavía no hay actividad registrada.');
      return;
    }

    wrap.innerHTML = UI.table(
      ['Fecha y hora', 'Usuario', 'Rol', 'Acción', 'Detalle'],
      log.slice(0, 500).map(e => ({
        cells: [
          formatDateTime(e.timestamp),
          UI.escapeHtml(e.user),
          '<span class="chip ' + (e.role === 'admin' ? '' : 'blue') + '">' + (e.role === 'admin' ? 'Administrador' : 'Empleado') + '</span>',
          UI.escapeHtml(e.action),
          '<span class="desc-cell">' + UI.escapeHtml(e.details || '—') + '</span>'
        ]
      }))
    );
  });
});
