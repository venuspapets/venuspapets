'use client';

import { useState, useTransition } from 'react';
import { WarningDialog } from '@/components/WarningDialog';
import { deleteAppointment } from './actions';

/** Botón para eliminar una cita programada, con confirmación. */
export function DeleteAppointment({ id, petName, when }: { id: string; petName: string; when: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const res = await deleteAppointment(null, fd);
      if (res?.error) { setError(res.error); setOpen(false); }
    });
  }

  return (
    <>
      {error && <div className="login-error" role="alert">{error}</div>}
      <button type="button" className="btn btn-danger" onClick={() => { setError(null); setOpen(true); }}>Eliminar cita</button>
      {open && (
        <WarningDialog
          warnings={[`Se eliminará la cita de ${petName} (${when}).`, 'Esta acción no se puede deshacer.']}
          question="¿Quieres eliminarla?" confirmLabel="Sí, eliminar" cancelLabel="No, conservarla"
          pending={pending} onConfirm={confirm} onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
