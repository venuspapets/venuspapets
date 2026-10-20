'use client';

import { useActionState } from 'react';
import { PasswordInput } from '@/components/PasswordInput';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { setNewPassword } from '../login/actions';

export default function NewPasswordPage() {
  const [state, action, pending] = useActionState(setNewPassword, null);

  return (
    <main className="login-wrap">
      <div className="login-card">
        <img className="login-logo" src="/logo.png" alt="Logo VenuSpa Pets" />
        <h1>Nueva contraseña</h1>
        <p className="subtitle">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>

        {state?.error && <div className="login-error" role="alert">{state.error}</div>}

        <form action={action}>
          <PasswordInput id="password" name="password" label="Contraseña nueva" autoComplete="new-password" />
          <PasswordInput id="confirm" name="confirm" label="Repite la contraseña" autoComplete="new-password" />
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </main>
  );
}
