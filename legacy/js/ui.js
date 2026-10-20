/**
 * ui.js — Componentes de interfaz compartidos entre todas las páginas:
 * encabezado, footer, modales, toast, tablas y exportaciones.
 */

const UI = (function () {
  const DEV_WHATSAPP = '573193034610'; // soporte / NOVA STUDIO
  const BRAND = 'VenuSpa Pets';

  const formatCurrency = Util.currency;
  const escapeHtml = Util.escapeHtml;

  function whatsappLink(message) {
    return Util.waLink(DEV_WHATSAPP, message);
  }

  function supportLink() {
    return whatsappLink('Hola, necesito soporte para el producto ' + BRAND + '.');
  }

  /* ------------------------------ Header ------------------------------ */

  const WA_ICON =
    '<svg viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M16.02 3C9.4 3 4 8.4 4 15.02c0 2.35.66 4.55 1.8 6.43L4 29l7.72-1.75a11.9 11.9 0 0 0 4.3.8c6.63 0 12.02-5.4 12.02-12.03C28.04 8.4 22.65 3 16.02 3zm0 21.86c-1.5 0-2.96-.4-4.24-1.15l-.3-.18-4.58 1.04 1.03-4.46-.2-.32a9.83 9.83 0 0 1-1.53-5.27c0-5.46 4.44-9.9 9.9-9.9 5.46 0 9.9 4.44 9.9 9.9-.01 5.46-4.45 9.9-9.98 9.9z"/>' +
    '<path d="M21.5 18.02c-.29-.15-1.7-.84-1.96-.93-.26-.1-.46-.15-.65.15-.2.29-.75.93-.92 1.12-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.87-.77-1.45-1.73-1.62-2.02-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.08-.15-.65-1.57-.89-2.15-.24-.57-.48-.49-.65-.5h-.56c-.2 0-.51.07-.78.37-.26.29-1.02 1-1.02 2.44 0 1.44 1.05 2.83 1.2 3.02.15.2 2.06 3.14 5 4.4.7.3 1.24.48 1.67.62.7.22 1.33.19 1.84.11.56-.08 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.2-.55-.34z"/>' +
    '</svg>';

  /** Construye el encabezado a partir de los data-* del <body>. */
  function renderHeader() {
    const body = document.body;
    const title = body.getAttribute('data-title');
    if (!title) return;
    const back = body.getAttribute('data-back');
    const hasSupport = body.hasAttribute('data-support');

    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML =
      '<div class="site-header__inner">' +
        '<img class="site-header__logo" src="assets/logo.png" alt="Logo VenuSpa Pets">' +
        '<div class="site-header__brand"><strong>' + BRAND + '</strong><span>' + escapeHtml(title) + '</span></div>' +
        '<div class="site-header__spacer"></div>' +
        '<div class="site-header__actions">' +
          '<span class="user-pill" id="userPill"></span>' +
          (hasSupport ? '<a class="btn-support" id="supportBtn" target="_blank" rel="noopener">' + WA_ICON + '<span class="btn-support__text">Soporte</span></a>' : '') +
          (back ? '<button class="btn-back" id="backBtn" data-fallback="' + back + '">← Volver</button>' : '') +
          '<button class="btn-logout" id="logoutBtn">Cerrar sesión</button>' +
        '</div>' +
      '</div>';
    body.insertBefore(header, body.firstChild);
    const support = document.getElementById('supportBtn');
    if (support) support.href = supportLink();
  }

  /* ------------------------------ Footer ------------------------------ */

  function injectFooter() {
    if (document.querySelector('.site-footer')) return;
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = 'Desarrollado por <a class="dev-link" id="devLink">NOVA STUDIO — Contáctanos</a>';
    document.body.appendChild(footer);
    document.getElementById('devLink').addEventListener('click', function () {
      window.open(whatsappLink('Hola NOVA STUDIO, quiero información sobre mi página web.'), '_blank');
    });
  }

  /* ------------------------------ Toast ------------------------------ */

  let toastTimer = null;
  function showToast(message, type) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.textContent = message;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  /* ------------------------------ Modal genérico ------------------------------ */

  function openModal(innerHtml, options) {
    options = options || {};
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'activeModal';
    overlay.innerHTML = '<div class="modal-box' + (options.wide ? ' modal-wide' : '') + '">' + innerHtml + '</div>';
    document.body.appendChild(overlay);

    if (options.closeOnOverlay !== false) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }
    requestAnimationFrame(() => overlay.classList.add('open'));
    return overlay;
  }

  function closeModal() {
    const existing = document.getElementById('activeModal');
    if (existing) existing.remove();
  }

  /** Muestra una foto a tamaño completo. */
  function showPhoto(src, title) {
    openModal(
      '<h2>' + escapeHtml(title || 'Foto') + '</h2><img class="photo-full" src="' + src + '" alt="">' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="photoCloseBtn">Cerrar</button></div>',
      { wide: true }
    );
    document.getElementById('photoCloseBtn').addEventListener('click', closeModal);
  }

  /* ------------------------------ Registro de actividad ------------------------------ */

  function logAction(action, details) {
    const session = AUTH.getSession();
    if (!session) return Promise.resolve(false);
    return DataService.logActivity({ user: session.user, role: session.role, action, details });
  }

  /* ------------------------------ Componentes HTML ------------------------------ */

  /** Avatar de mascota: foto o emoji. size = sm | md | lg */
  function petAvatar(pet, size) {
    const inner = pet && pet.photo ? '<img src="' + pet.photo + '" alt="' + escapeHtml(pet.name) + '">' : '🐶';
    return '<span class="pet-avatar sz-' + (size || 'sm') + '">' + inner + '</span>';
  }

  /** Tabla con el mismo estilo de FerreAmigo. columns: [titulo], rows: [[html, ...]] */
  function table(columns, rows, opts) {
    opts = opts || {};
    const numCols = opts.numCols || [];
    const head = columns.map((c, i) => '<th' + (numCols.includes(i) ? ' class="num"' : '') + '>' + c + '</th>').join('');
    const body = rows.map(r =>
      '<tr' + (r.attrs ? ' ' + r.attrs : '') + '>' +
      r.cells.map((cell, i) => '<td data-label="' + escapeHtml(columns[i]) + '"' + (numCols.includes(i) ? ' class="num"' : '') + '>' + cell + '</td>').join('') +
      '</tr>'
    ).join('');
    return '<div class="product-table-wrap"><table class="product-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function emptyState(emoji, text) {
    return '<div class="empty-state"><div class="emoji">' + emoji + '</div><p>' + text + '</p></div>';
  }

  /* ------------------------------ Fotos ------------------------------ */

  /** Reduce una imagen a un data URL liviano (JPEG) para guardarla sin saturar el almacenamiento. */
  function fileToDataUrl(file, maxSize) {
    maxSize = maxSize || 480;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen no válida'));
        img.onload = () => {
          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Cablea un <input type=file> con una vista previa. Devuelve un objeto con
   * get() para leer el data URL actual.
   */
  function wirePhotoInput(inputEl, imgEl, initial) {
    let current = initial || null;
    if (current) { imgEl.src = current; imgEl.classList.remove('hidden'); }
    inputEl.addEventListener('change', function () {
      const file = inputEl.files && inputEl.files[0];
      if (!file) return;
      fileToDataUrl(file).then(url => {
        current = url;
        imgEl.src = url;
        imgEl.classList.remove('hidden');
      }).catch(err => showToast(err.message, 'danger'));
    });
    return { get: () => current, clear: () => { current = null; imgEl.classList.add('hidden'); } };
  }

  /* ------------------------------ Exportar ------------------------------ */

  function download(filename, content, mime) {
    const blob = new Blob(['﻿' + content], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /** Excel: genera un .xls (tablas HTML) que Excel abre con una hoja por reporte. sections: [{title, headers, rows}] */
  function downloadExcel(filename, sections) {
    const html = sections.map(s =>
      '<table border="1"><tr><td colspan="' + s.headers.length + '"><b>' + escapeHtml(s.title) + '</b></td></tr>' +
      '<tr>' + s.headers.map(h => '<th style="background:#E9D8F5">' + escapeHtml(h) + '</th>').join('') + '</tr>' +
      s.rows.map(r => '<tr>' + r.map(c => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>').join('') +
      '</table><br>'
    ).join('');
    download(filename, '<html><head><meta charset="UTF-8"></head><body>' + html + '</body></html>', 'application/vnd.ms-excel');
  }

  /** PDF: abre el diálogo de impresión (elegir "Guardar como PDF"). */
  function printPage() {
    window.print();
  }


  /* ------------------------------ Listas con búsqueda ------------------------------ */

  /**
   * Agrega un cuadro de búsqueda sobre un <select> con muchas opciones.
   * Filtra por el texto de la opción (ej. "Nieve — Carolina Restrepo": sirve buscar por mascota o por tutor).
   */
  function enhanceSelect(select, minOptions) {
    if (!select || select.disabled || select.options.length < (minOptions || 8) || select.dataset.searchable) return;
    select.dataset.searchable = '1';
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'select-search';
    input.placeholder = '🔍 Buscar...';
    input.setAttribute('autocomplete', 'off');
    select.parentNode.insertBefore(input, select);

    input.addEventListener('input', function () {
      const q = Util.norm(input.value);
      let visible = 0;
      let firstVisible = null;
      Array.from(select.options).forEach(function (opt) {
        const show = !q || Util.norm(opt.textContent).includes(q) || opt.value === '';
        opt.hidden = !show;
        opt.disabled = !show;
        if (show && opt.value !== '') { visible++; if (!firstVisible) firstVisible = opt; }
      });
      if (q) select.size = Math.min(6, Math.max(2, visible + 1)); else select.removeAttribute('size');
      const current = select.options[select.selectedIndex];
      if (firstVisible && (!current || current.hidden)) {
        select.value = firstVisible.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    select.addEventListener('change', function () { if (!input.value) select.removeAttribute('size'); });
    // Al elegir una opción de la lista abierta, se cierra la lista y se limpia la búsqueda.
    select.addEventListener('click', function () {
      if (select.size > 1 && select.value) { select.removeAttribute('size'); input.value = ''; Array.from(select.options).forEach(o => { o.hidden = false; o.disabled = false; }); }
    });
  }

  /* ------------------------------ Header: sesión y volver ------------------------------ */

  function wireHeaderCommon() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => AUTH.logout());

    // "Volver" siempre hacia la página padre, en vez de history.back():
    // así nunca saca al usuario de la app aunque haya recargado la página.
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = backBtn.getAttribute('data-fallback') || 'modulos.html';
      });
    }

    const userPill = document.getElementById('userPill');
    const session = AUTH.getSession();
    if (userPill && session) {
      userPill.textContent = 'Usuario: ' + session.user + ' (' + (session.role === 'admin' ? 'Administrador' : 'Empleado') + ')';
    }
  }

  /** Campos numéricos: al enfocar uno que solo tiene "0", se vacía para no escribir "0100". */
  function wireNumericZeroClear() {
    document.addEventListener('focusin', function (e) {
      if (e.target.tagName === 'INPUT' && e.target.type === 'number' && e.target.value === '0') {
        e.target.value = '';
      }
    });
  }

  function init() {
    renderHeader();
    injectFooter();
    wireHeaderCommon();
    wireNumericZeroClear();
  }

  // Errores no controlados (por ejemplo, almacenamiento lleno al guardar una foto).
  window.addEventListener('unhandledrejection', function (e) {
    console.error(e.reason);
    showToast('No se pudo guardar: ' + (e.reason && e.reason.name === 'QuotaExceededError'
      ? 'el almacenamiento del navegador está lleno (demo).' : 'ocurrió un error.'), 'danger');
  });

  return {
    whatsappLink, supportLink, formatCurrency, escapeHtml,
    showToast, openModal, closeModal, showPhoto,
    logAction, petAvatar, table, emptyState,
    fileToDataUrl, wirePhotoInput, downloadExcel, printPage, enhanceSelect, init
  };
})();

document.addEventListener('DOMContentLoaded', UI.init);
