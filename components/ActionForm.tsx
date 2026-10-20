'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/form';

/** Formulario que ejecuta una acción del servidor y muestra el resultado al lado del botón. */
export function ActionForm({ action, children, submitLabel = 'Guardar', buttonClass = 'btn btn-primary', className }: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  buttonClass?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="form-actions">
        <button type="submit" className={buttonClass} disabled={pending}>{pending ? 'Guardando…' : submitLabel}</button>
        {state?.error && <span className="msg-error" role="alert">{state.error}</span>}
        {state?.ok && <span className="msg-ok" role="status">{state.ok}</span>}
      </div>
    </form>
  );
}
