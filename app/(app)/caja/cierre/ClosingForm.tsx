'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { money, pesos } from '@/lib/money';
import { closeDay, reopenDay } from '../actions';

type Closing = { counted: number | null; difference: number | null; notes: string; closedAt: string };

const diffText = (d: number) => (d === 0 ? 'La caja cuadra.' : d > 0 ? `Sobran ${money(d)}.` : `Faltan ${money(-d)}.`);

export function ClosingForm({ date, expectedCash, closing }: { date: string; expectedCash: number; closing: Closing | null }) {
  const [counted, setCounted] = useState('');

  if (closing) {
    return (
      <>
        <h3>Día cerrado</h3>
        <ul className="plain-list">
          <li>Efectivo esperado: <strong>{money(expectedCash)}</strong></li>
          <li>Efectivo contado: <strong>{closing.counted === null ? 'No se contó' : money(closing.counted)}</strong></li>
          {closing.difference !== null && <li className={closing.difference === 0 ? 'msg-ok' : 'msg-error'}>{diffText(closing.difference)}</li>}
          {closing.notes && <li>Notas: {closing.notes}</li>}
        </ul>
        <ActionForm action={reopenDay} submitLabel="Reabrir cierre" buttonClass="btn btn-ghost">
          <input type="hidden" name="date" value={date} />
        </ActionForm>
      </>
    );
  }

  const entered = counted.trim() !== '';
  const difference = pesos(counted) - expectedCash;

  return (
    <ActionForm action={closeDay} submitLabel="Cerrar el día">
      <input type="hidden" name="date" value={date} />
      <p>Efectivo que debería haber en la caja: <strong>{money(expectedCash)}</strong></p>
      <div className="row-form">
        <div className="field" style={{ flex: '0 0 220px' }}>
          <label htmlFor="counted_cash">Efectivo contado</label>
          <input id="counted_cash" name="counted_cash" inputMode="numeric" value={counted} onChange={e => setCounted(e.target.value)} placeholder="$" />
        </div>
        {entered && <span className={difference === 0 ? 'msg-ok' : 'msg-error'}>{diffText(difference)}</span>}
      </div>
      <div className="field"><label htmlFor="notes">Notas del cierre</label><input id="notes" name="notes" /></div>
    </ActionForm>
  );
}
