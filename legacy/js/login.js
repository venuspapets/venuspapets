document.addEventListener('DOMContentLoaded', function () {
  // Si ya hay sesión activa, saltar directo a los módulos.
  if (AUTH.isAuthenticated()) {
    window.location.href = 'modulos.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePassword');

  toggleBtn.addEventListener('click', function () {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    toggleBtn.textContent = showing ? '👁️' : '🙈';
    toggleBtn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = passwordInput.value;

    if (AUTH.login(username, password)) {
      errorBox.classList.remove('show');
      const session = AUTH.getSession();
      DataService.logActivity({
        user: session.user,
        role: session.role,
        action: 'Inicio de sesión'
      }).then(() => {
        window.location.href = 'modulos.html';
      });
    } else {
      errorBox.classList.add('show');
    }
  });
});
