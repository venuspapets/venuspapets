'use client';

import { useState, useTransition } from 'react';
import { undoReminder } from './actions';

export function UndoButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function undo() {
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const res = await undoReminder(null, fd);
      if (res?.error) setError(res.error);
      window.dispatchEvent(new Event('reminders-updated'));
    });
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={undo}>Deshacer</button>
      {error && <small className="msg-error"> {error}</small>}
    </>
  );
}
