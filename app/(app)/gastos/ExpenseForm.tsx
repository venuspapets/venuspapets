'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { saveExpense } from './actions';

export type ExpenseRow = {
  id: string; expense_date: string; category_id: string | null; description: string; amount: number;
  payment_method_id: string | null; from_cash: boolean; supplier: string; receipt_path: string | null; status: string;
};
type Option = { id: string; name: string };
type Method = Option & { is_cash: boolean };

export function ExpenseForm({ categories, methods, expense, today, receiptUrl }: {
  categories: Option[]; methods: Method[]; expense?: ExpenseRow; today: string; receiptUrl?: string | null;
}) {
  const [methodId, setMethodId] = useState(expense?.payment_method_id ?? methods[0]?.id ?? '');
  const [fromCash, setFromCash] = useState(expense?.from_cash ?? methods[0]?.is_cash ?? false);
  const [touched, setTouched] = useState(!!expense);

  // Al elegir un medio en efectivo se propone que el gasto salió de la caja (se puede cambiar).
  const pickMethod = (id: string) => {
    setMethodId(id);
    if (!touched) setFromCash(methods.find(m => m.id === id)?.is_cash ?? false);
  };

  return (
    <ActionForm action={saveExpense} submitLabel={expense ? 'Guardar gasto' : 'Registrar gasto'}>
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <div className="row-form">
        <div className="field" style={{ flex: '0 0 170px' }}><label htmlFor="expense_date">Fecha</label><input id="expense_date" name="expense_date" type="date" defaultValue={expense?.expense_date ?? today} required /></div>
        <div className="field">
          <label htmlFor="category_id">Categoría</label>
          <select id="category_id" name="category_id" defaultValue={expense?.category_id ?? ''} required>
            <option value="">— Elige una categoría —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '0 0 190px' }}><label htmlFor="amount">Monto</label><input id="amount" name="amount" inputMode="numeric" defaultValue={expense?.amount} placeholder="$" required /></div>
      </div>
      <div className="row-form">
        <div className="field"><label htmlFor="description">Descripción</label><input id="description" name="description" defaultValue={expense?.description} placeholder="ej. Champú y toallas" required /></div>
        <div className="field"><label htmlFor="supplier">Proveedor (opcional)</label><input id="supplier" name="supplier" defaultValue={expense?.supplier} /></div>
      </div>
      <div className="row-form">
        <div className="field">
          <label htmlFor="payment_method_id">Medio de pago</label>
          <select id="payment_method_id" name="payment_method_id" value={methodId} onChange={e => pickMethod(e.target.value)} required>
            {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" name="from_cash" checked={fromCash} onChange={e => { setTouched(true); setFromCash(e.target.checked); }} /> Salió de la caja
        </label>
      </div>
      <p className="muted">Actívalo si el gasto se pagó con la plata de la caja del día: el efectivo esperado en el cierre baja por ese valor.</p>
      <div className="field">
        <label htmlFor="receipt">{expense?.receipt_path ? 'Cambiar comprobante' : 'Comprobante (opcional)'}</label>
        <input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
        <small className="muted">Foto o PDF de la factura, hasta 4 MB.{receiptUrl && <> <a href={receiptUrl} target="_blank" rel="noopener noreferrer">Ver el comprobante actual</a></>}</small>
      </div>
    </ActionForm>
  );
}
