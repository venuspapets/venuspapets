'use client';

import { useActionState } from 'react';
import { PasswordInput } from '@/components/PasswordInput';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { changePassword } from './actions';

export default function AccountPage() {
  const [state, action, pending] = useActionState(changePassword, null);

  return (
    <>
      <h1>Mi cuenta</h1>
      <section className="panel">
        <h2>Cambiar contraseña</h2>
        <p className="muted">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>

        {state?.error && <div className="login-error" role="alert">{state.error}</div>}
        {state?.ok && <div className="login-ok" role="status">{state.ok}</div>}

        <form action={action} key={state?.ok ? 'done' : 'form'}>
          <PasswordInput id="current" name="current" label="Contraseña actual" autoComplete="current-password" />
          <PasswordInput id="password" name="password" label="Contraseña nueva" autoComplete="new-password" />
          <PasswordInput id="confirm" name="confirm" label="Repite la contraseña nueva" autoComplete="new-password" />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </>
  );
}
