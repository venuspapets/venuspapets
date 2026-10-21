import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { money } from '@/lib/money';
import { ExpenseForm, type ExpenseRow } from '../ExpenseForm';
import { voidExpense } from '../actions';

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const [{ data: e }, { data: categories }, { data: methods }] = await Promise.all([
    supabase.from('expenses').select('*').eq('id', id).maybeSingle(),
    supabase.from('expense_categories').select('id, name, active').order('sort_order'),
    supabase.from('payment_methods').select('id, name, is_cash, active').order('sort_order')
  ]);
  if (!e) notFound();

  const receiptUrl = e.receipt_path ? (await supabase.storage.from('receipts').createSignedUrl(e.receipt_path, 3600)).data?.signedUrl : null;
  const voided = e.status === 'anulado';
  // Se muestran los activos y, si el gasto usa uno que ya se desactivó, ese también.
  const cats = (categories ?? []).filter(c => c.active || c.id === e.category_id);
  const meths = (methods ?? []).filter(m => m.active || m.id === e.payment_method_id);

  return (
    <>
      <PageHeader
        title="Gasto"
        description="Corrige los datos del gasto o anúlalo si se registró por error. Un gasto pagado de la caja no se puede cambiar si el día ya está cerrado: reabre el cierre primero."
      />
      <div className="back-bar"><Link className="btn btn-ghost" href="/gastos">← Volver a gastos</Link></div>

      <section className="panel wide">
        <h2>{e.description} · {money(e.amount)} {voided && <span className="badge badge-warn">Anulado</span>}</h2>
        {voided
          ? <p className="login-error"><strong>Anulado:</strong> {e.void_reason}</p>
          : <ExpenseForm categories={cats} methods={meths} expense={e as ExpenseRow} today={e.expense_date} receiptUrl={receiptUrl} />}
        {voided && receiptUrl && <p><a href={receiptUrl} target="_blank" rel="noopener noreferrer">Ver el comprobante</a></p>}
      </section>

      {!voided && (
        <section className="panel wide">
          <h2>Anular gasto</h2>
          <p className="muted">Úsalo si el gasto se registró por error. No se borra: queda en el historial con el motivo.</p>
          <ActionForm action={voidExpense} submitLabel="Anular gasto" buttonClass="btn btn-danger">
            <input type="hidden" name="id" value={e.id} />
            <div className="field"><label htmlFor="reason">Motivo</label><input id="reason" name="reason" required /></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
