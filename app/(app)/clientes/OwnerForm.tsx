'use client';

import { useRef, useState, useTransition } from 'react';
import { WarningDialog } from '@/components/WarningDialog';
import type { WarnState } from '@/lib/form';
import { saveOwner } from './actions';

export type OwnerRow = {
  id: string; full_name: string; whatsapp: string; address: string; birthday: string | null;
  consent_messages: boolean; referred_by: string | null; notes: string; active: boolean;
};

export function OwnerForm({ owner, others }: { owner?: OwnerRow; others: { id: string; full_name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<WarnState>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(confirm: boolean) {
    const fd = new FormData(formRef.current!);
    if (confirm) fd.set('confirm', '1');
    startTransition(async () => {
      setState(await saveOwner(null, fd));
      setDismissed(false);
    });
  }

  const warnings = state?.warnings && !dismissed ? state.warnings : null;

  return (
    <form ref={formRef} onSubmit={e => { e.preventDefault(); submit(false); }}>
      {owner && <input type="hidden" name="id" value={owner.id} />}
      <div className="row-form">
        <div className="field"><label htmlFor="full_name">Nombre completo</label><input id="full_name" ref={nameRef} name="full_name" defaultValue={owner?.full_name} required /></div>
        <div className="field">
          <label htmlFor="whatsapp">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" inputMode="tel" defaultValue={owner?.whatsapp} placeholder="3001234567" />
        </div>
      </div>
      <div className="row-form">
        <div className="field"><label htmlFor="address">Dirección</label><input id="address" name="address" defaultValue={owner?.address} /></div>
        <div className="field"><label htmlFor="birthday">Cumpleaños</label><input id="birthday" name="birthday" type="date" defaultValue={owner?.birthday ?? ''} /></div>
      </div>
      <div className="row-form">
        <div className="field">
          <label htmlFor="referred_by">Referido por</label>
          <select id="referred_by" name="referred_by" defaultValue={owner?.referred_by ?? ''}>
            <option value="">— Nadie —</option>
            {others.filter(o => o.id !== owner?.id).map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor="notes">Notas</label><textarea id="notes" name="notes" rows={2} defaultValue={owner?.notes} /></div>
      <label className="check"><input type="checkbox" name="consent_messages" defaultChecked={owner?.consent_messages ?? true} /> Autoriza recibir mensajes por WhatsApp (recordatorios y promociones)</label>
      {owner && <label className="check"><input type="checkbox" name="active" defaultChecked={owner.active} /> Cliente activo</label>}

      {state?.error && <div className="login-error" role="alert">{state.error}</div>}
      {state?.ok && <div className="login-ok" role="status">{state.ok}</div>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Guardando…' : owner ? 'Guardar cliente' : 'Crear cliente'}
        </button>
      </div>

      {warnings && (
        <WarningDialog
          warnings={warnings} question={owner ? '¿Guardar los cambios de todos modos?' : '¿Quieres crear el cliente de todos modos?'}
          confirmLabel="Sí, continuar" cancelLabel="No, revisar los datos" pending={pending}
          onConfirm={() => submit(true)}
          onCancel={() => { setDismissed(true); nameRef.current?.focus(); }}
        />
      )}
    </form>
  );
}
