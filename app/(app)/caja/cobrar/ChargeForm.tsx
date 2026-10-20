'use client';

import { useRef, useState, useTransition } from 'react';
import { money, pesos } from '@/lib/money';
import type { FormState } from '@/lib/form';
import { registerVisit } from '../actions';

export type CatalogItem = { id: string; name: string; price: number | null };
export type MethodOption = { id: string; name: string };
type Line = { key: number; service_id: string; name: string; price: string };
type Pay = { key: number; method_id: string; amount: string };

export function ChargeForm({ petId, appointmentId, groomerId, visitDate, catalog, methods, initial }: {
  petId: string; appointmentId: string | null; groomerId: string; visitDate: string;
  catalog: CatalogItem[]; methods: MethodOption[]; initial: { service_id: string; name: string; price: number }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(100);
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();

  const [lines, setLines] = useState<Line[]>(initial.map((l, i) => ({ key: i, service_id: l.service_id, name: l.name, price: String(l.price) })));
  const [discount, setDiscount] = useState('0');
  const [payments, setPayments] = useState<Pay[]>([{ key: 0, method_id: methods[0]?.id ?? '', amount: '' }]);
  const [notes, setNotes] = useState('');

  const subtotal = lines.reduce((s, l) => s + pesos(l.price), 0);
  const pct = Math.min(100, Math.max(0, Number(discount.replace(',', '.')) || 0));
  const discountAmount = Math.round(subtotal * pct / 100);
  const total = subtotal - discountAmount;

  // Con un solo medio de pago, el monto es el total; con varios, se reparte a mano.
  const single = payments.length === 1;
  const paid = single ? total : payments.reduce((s, p) => s + pesos(p.amount), 0);
  const remaining = total - paid;
  const canSubmit = lines.length > 0 && remaining === 0 && !pending;

  const addLine = (id: string) => {
    const s = catalog.find(c => c.id === id);
    if (!s) return;
    setLines(cur => [...cur, { key: nextKey.current++, service_id: s.id, name: s.name, price: String(s.price ?? 0) }]);
  };

  function submit() {
    const fd = new FormData();
    const photo = formRef.current?.elements.namedItem('photo') as HTMLInputElement | null;
    if (photo?.files?.[0]) fd.set('photo', photo.files[0]);
    fd.set('payload', JSON.stringify({
      pet_id: petId, appointment_id: appointmentId, groomer_id: groomerId, visit_date: visitDate,
      discount_pct: pct, notes,
      items: lines.map(l => ({ service_id: l.service_id, name: l.name, price: pesos(l.price) })),
      payments: (single ? [{ ...payments[0], amount: String(total) }] : payments)
        .map(p => ({ method_id: p.method_id, amount: pesos(p.amount) })).filter(p => p.amount > 0)
    }));
    startTransition(async () => setState(await registerVisit(null, fd)));
  }

  return (
    <form ref={formRef} onSubmit={e => { e.preventDefault(); if (canSubmit) submit(); }}>
      <h2>Servicios</h2>
      {lines.length === 0 && <p className="muted">Agrega al menos un servicio.</p>}
      {lines.map(l => (
        <div className="row-form" key={l.key}>
          <span className="line-name">{l.name}</span>
          <div className="field" style={{ flex: '0 0 150px' }}>
            <input value={l.price} inputMode="numeric" aria-label={`Precio de ${l.name}`}
              onChange={e => setLines(cur => cur.map(x => x.key === l.key ? { ...x, price: e.target.value } : x))} />
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setLines(cur => cur.filter(x => x.key !== l.key))}>Quitar</button>
        </div>
      ))}
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="add-service">Agregar servicio</label>
        <select id="add-service" value="" onChange={e => addLine(e.target.value)}>
          <option value="">— Elige un servicio —</option>
          {catalog.map(c => <option key={c.id} value={c.id}>{c.name}{c.price === null ? ' (sin precio para esta mascota)' : ` — ${money(c.price)}`}</option>)}
        </select>
      </div>

      <h2>Descuento</h2>
      <div className="row-form">
        <div className="field" style={{ flex: '0 0 140px' }}>
          <label htmlFor="discount">Porcentaje (%)</label>
          <input id="discount" value={discount} inputMode="decimal" onChange={e => setDiscount(e.target.value)} />
        </div>
        <span className="muted">{pct > 0 ? `Equivale a ${money(discountAmount)} de descuento` : 'Sin descuento'}</span>
      </div>

      <div className="totals">
        <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {pct > 0 && <div><span>Descuento ({pct}%)</span><span>− {money(discountAmount)}</span></div>}
        <div className="grand"><span>Total a cobrar</span><span>{money(total)}</span></div>
      </div>

      <h2>Pago</h2>
      {total === 0 ? <p className="muted">No hay nada que pagar.</p> : payments.map(p => (
        <div className="row-form" key={p.key}>
          <div className="field">
            <select value={p.method_id} aria-label="Medio de pago"
              onChange={e => setPayments(cur => cur.map(x => x.key === p.key ? { ...x, method_id: e.target.value } : x))}>
              {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 160px' }}>
            <input value={single ? String(total) : p.amount} inputMode="numeric" readOnly={single} aria-label="Monto" placeholder="Monto"
              onChange={e => setPayments(cur => cur.map(x => x.key === p.key ? { ...x, amount: e.target.value } : x))} />
          </div>
          {!single && <button type="button" className="btn btn-ghost" onClick={() => setPayments(cur => cur.filter(x => x.key !== p.key))}>Quitar</button>}
        </div>
      ))}
      {total > 0 && (
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setPayments(cur => [...cur, { key: nextKey.current++, method_id: methods[0]?.id ?? '', amount: single ? '' : '' }])}>
            + Pagar con otro medio
          </button>
          {!single && (
            <p className={remaining === 0 ? 'msg-ok' : 'msg-error'}>
              {remaining === 0 ? 'Los pagos cuadran con el total.' : remaining > 0 ? `Faltan ${money(remaining)} por asignar.` : `Sobran ${money(-remaining)}.`}
            </p>
          )}
        </>
      )}

      <div className="field" style={{ marginTop: '1rem' }}>
        <label htmlFor="photo">Foto de la mascota (opcional)</label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        <small className="muted">Una foto que permita identificar a la mascota. JPG, PNG o WebP de hasta 4 MB.</small>
      </div>
      <div className="field"><label htmlFor="notes">Notas del servicio</label><textarea id="notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>

      {state?.error && <div className="login-error" role="alert">{state.error}</div>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>{pending ? 'Registrando…' : `Cobrar ${money(total)}`}</button>
      </div>
    </form>
  );
}
