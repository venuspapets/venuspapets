/**
 * auth.js — Autenticación de la sesión.
 * Nota: validación 100% en cliente, solo para la maqueta funcional.
 * Al pasar a backend real, reemplazar login() por una llamada a la API
 * que devuelva un token, y requireAuth() por una verificación de ese token.
 */

const AUTH = (function () {
  const SESSION_KEY = 'vsp_session';

  // Perfiles válidos. "admin" (dueño) ve todo: reportes, gastos, precios, equipo.
  // "empleado" atiende clientes, agenda y caja, pero no ve finanzas.
  const USERS = [
    { username: 'venuspa', password: 'venuspa2024$', role: 'admin', label: 'Miguel Angel' },
    { username: 'empleado', password: 'empleado2024$', role: 'empleado', label: 'Empleado' }
  ];

  function login(username, password) {
    const match = USERS.find(u => u.username === username && u.password === password);
    if (!match) return false;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: match.username, role: match.role, loggedAt: Date.now() }));
    return true;
  }

  function isAdmin() {
    const session = getSession();
    return !!session && session.role === 'admin';
  }

  function isAuthenticated() {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  /** Llamar al inicio de cada página protegida. */
  function requireAuth() {
    if (!isAuthenticated()) {
      window.location.href = 'index.html';
    }
  }

  /** Llamar al inicio de páginas exclusivas del dueño (reportes, gastos, equipo...). */
  function requireAdmin() {
    requireAuth();
    if (!isAdmin()) {
      window.location.href = 'modulos.html';
    }
  }

  function listUsers() {
    return USERS.map(u => ({ username: u.username, role: u.role, label: u.label }));
  }

  return { login, isAuthenticated, isAdmin, getSession, logout, requireAuth, requireAdmin, listUsers };
})();
