'use client';

import { useActionState } from 'react';
import { requestPasswordReset } from '../login/actions';

export default function RecoverForm({ expired }: { expired: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <main className="login-wrap">
      <div className="login-card">
        <img className="login-logo" src="/logo.png" alt="Logo VenuSpa Pets" />
        <h1>Recuperar contraseña</h1>
        <p className="subtitle">Te enviaremos un enlace para crear una contraseña nueva.</p>

        {expired && !state && <div className="login-error" role="alert">El enlace no es válido o ya venció. Pide uno nuevo.</div>}
        {state?.error && <div className="login-error" role="alert">{state.error}</div>}
        {state?.ok && <div className="login-ok" role="status">{state.ok}</div>}

        <form action={action}>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="tucorreo@ejemplo.com" required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        <p className="login-hint"><a href="/login">Volver al inicio de sesión</a></p>
      </div>
    </main>
  );
}
