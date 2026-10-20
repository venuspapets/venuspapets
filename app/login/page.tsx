'use client';

import { useActionState, useState } from 'react';
import { login } from './actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  const [show, setShow] = useState(false);

  return (
    <main className="login-wrap">
      <div className="login-card">
        <img className="login-logo" src="/logo.png" alt="Logo VenuSpa Pets" />
        <h1>VenuSpa Pets</h1>
        <p className="tagline">Peluquería Canina</p>
        <p className="subtitle">Sistema de administración interno</p>

        {state?.error && <div className="login-error" role="alert">{state.error}</div>}

        <form action={action}>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="tucorreo@ejemplo.com" required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <div className="password-field">
              <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu contraseña" required />
              <button type="button" className="password-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="login-hint"><a href="/recuperar">¿Olvidaste tu contraseña?</a></p>
        <p className="login-hint">Acceso restringido al personal autorizado de VenuSpa Pets.</p>
      </div>
    </main>
  );
}
