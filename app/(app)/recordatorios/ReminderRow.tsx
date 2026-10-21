'use client';

import { useState, useTransition } from 'react';
import { sendReminder } from './actions';

/** Un recordatorio pendiente: abre WhatsApp con el mensaje listo y anota el envío. */
export function ReminderRow({ reminderKey, href, petName, ownerName, info, lastSentText }: {
  reminderKey: string; href: string; petName: string; ownerName: string; info: string; lastSentText: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    // La ventana se abre en el mismo clic para que el navegador no la bloquee.
    window.open(href, '_blank', 'noopener,noreferrer');
    const fd = new FormData();
    fd.set('key', reminderKey);
    startTransition(async () => {
      const res = await sendReminder(null, fd);
      if (res?.error) setError(res.error);
      window.dispatchEvent(new Event('reminders-updated'));
    });
  }

  return (
    <div className="reminder">
      <div className="reminder-main">
        <strong>{petName}</strong> <span className="muted">({ownerName})</span>
        <div>{info}</div>
        {lastSentText && <small className="muted">Último mensaje enviado: {lastSentText}</small>}
        {error && <div className="msg-error" role="alert">{error}</div>}
      </div>
      <button type="button" className="btn btn-primary" disabled={pending} onClick={send}>
        {pending ? 'Anotando…' : 'Enviar por WhatsApp'}
      </button>
    </div>
  );
}
