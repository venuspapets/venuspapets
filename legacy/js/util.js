/**
 * util.js — Utilidades puras (fechas, moneda, teléfonos). Sin dependencias.
 * Las fechas se manejan como texto local "YYYY-MM-DD" (nunca toISOString,
 * que devuelve UTC y en Colombia cambia el día después de las 7 p. m.).
 */

const Util = (function () {
  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parse(str) {
    const p = String(str).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
  }

  function today() { return ymd(new Date()); }

  function addDays(str, n) {
    const d = parse(str);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }

  /** Días entre dos fechas (b - a). */
  function diffDays(a, b) {
    return Math.round((parse(b) - parse(a)) / 86400000);
  }

  function startOfWeek(str) {
    const d = parse(str);
    const dow = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - dow);
    return ymd(d);
  }

  function startOfMonth(str) { return str.slice(0, 8) + '01'; }

  function endOfMonth(str) {
    const d = parse(str);
    return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  }

  function weekdayName(str) { return DAYS[parse(str).getDay()]; }

  /** "martes 14 de octubre" */
  function formatLong(str) {
    const d = parse(str);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
  }

  /** "14/10/2026" */
  function formatShort(str) {
    if (!str) return '—';
    const p = str.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function formatTime(hhmm) {
    if (!hhmm) return '';
    const p = hhmm.split(':').map(Number);
    const h12 = p[0] % 12 === 0 ? 12 : p[0] % 12;
    return h12 + ':' + pad(p[1]) + ' ' + (p[0] < 12 ? 'a. m.' : 'p. m.');
  }

  function addMinutes(hhmm, minutes) {
    const p = hhmm.split(':').map(Number);
    const total = p[0] * 60 + p[1] + Number(minutes || 0);
    return pad(Math.floor(total / 60) % 24) + ':' + pad(total % 60);
  }

  /** Edad legible a partir de la fecha de nacimiento. */
  function age(birthdate) {
    if (!birthdate) return '—';
    const b = parse(birthdate);
    const n = new Date();
    let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
    if (n.getDate() < b.getDate()) months--;
    if (months < 0) return '—';
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (y === 0) return m + (m === 1 ? ' mes' : ' meses');
    return y + (y === 1 ? ' año' : ' años') + (m ? ' y ' + m + (m === 1 ? ' mes' : ' meses') : '');
  }

  /** Días con signo hasta el cumpleaños más cercano respecto a "from" (-182..182). */
  function birthdayDistance(birthdate, from) {
    if (!birthdate) return null;
    const b = parse(birthdate);
    const f = parse(from || today());
    let best = null;
    [f.getFullYear() - 1, f.getFullYear(), f.getFullYear() + 1].forEach(y => {
      const d = new Date(y, b.getMonth(), b.getDate(), 12);
      const diff = Math.round((d - f) / 86400000);
      if (best === null || Math.abs(diff) < Math.abs(best)) best = diff;
    });
    return best;
  }

  /** Días (>= 0) hasta el próximo cumpleaños. */
  function daysUntilBirthday(birthdate, from) {
    if (!birthdate) return null;
    const b = parse(birthdate);
    const f = parse(from || today());
    let next = new Date(f.getFullYear(), b.getMonth(), b.getDate(), 12);
    if (next < f) next = new Date(f.getFullYear() + 1, b.getMonth(), b.getDate(), 12);
    return Math.round((next - f) / 86400000);
  }

  function currency(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Minúsculas sin tildes, para búsquedas. */
  function norm(str) {
    return String(str == null ? '' : str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function normalizePhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    if (d.length === 10) return '57' + d;
    return d;
  }

  function waLink(phone, message) {
    const text = message ? '?text=' + encodeURIComponent(message) : '';
    return 'https://wa.me/' + normalizePhone(phone) + text;
  }

  function formatPhone(p) {
    const d = normalizePhone(p);
    if (d.length === 12 && d.startsWith('57')) return '+57 ' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8);
    return p || '—';
  }

  function sum(list, fn) {
    return list.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
  }

  function byId(list) {
    const map = {};
    list.forEach(x => { map[x.id] = x; });
    return map;
  }

  return {
    pad, ymd, parse, today, addDays, diffDays, startOfWeek, startOfMonth, endOfMonth,
    weekdayName, formatLong, formatShort, formatTime, addMinutes, age,
    birthdayDistance, daysUntilBirthday,
    currency, escapeHtml, norm, normalizePhone, waLink, formatPhone, sum, byId
  };
})();
