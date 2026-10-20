import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { money } from '@/lib/money';
import { formatDay } from '@/lib/time';
import { voidVisit } from '../actions';

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase.from('visits')
    .select('*, pets(id, name, owners(id, full_name)), visit_items(id, name, price), visit_payments(id, method_name, amount)')
    .eq('id', id).maybeSingle();
  if (!v) notFound();

  const admin = await isAdmin();
  const pet = v.pets as { id: string; name: string; owners: { id: string; full_name: string } };
  const photoUrl = v.photo_path ? (await supabase.storage.from('pet-photos').createSignedUrl(v.photo_path, 3600)).data?.signedUrl : null;
  const voided = v.status === 'anulado';

  return (
    <>
      <PageHeader
        title={`Cobro de ${pet.name}`}
        description="Detalle de un servicio cobrado. Los cobros no se borran: si hubo un error, el administrador puede anularlo indicando el motivo y queda en el historial."
      />
      <p>
        <Link href={`/caja?fecha=${v.visit_date}`}>← Volver a caja</Link> · <Link href={`/clientes/${pet.owners.id}`}>{pet.owners.full_name}</Link> · {formatDay(v.visit_date)}
      </p>

      <section className="panel wide">
        <h2>{pet.name} {voided && <span className="badge badge-warn">Anulado</span>}</h2>
        {photoUrl && <img className="pet-photo" src={photoUrl} alt={`Foto de ${pet.name}`} />}

        <table className="table">
          <thead><tr><th>Servicio</th><th style={{ textAlign: 'right' }}>Precio</th></tr></thead>
          <tbody>
            {(v.visit_items as { id: string; name: string; price: number }[]).map(i => (
              <tr key={i.id}><td>{i.name}</td><td style={{ textAlign: 'right' }}>{money(i.price)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="totals">
          <div><span>Subtotal</span><span>{money(v.subtotal)}</span></div>
          {v.discount_amount > 0 && <div><span>Descuento ({Number(v.discount_pct)}%)</span><span>− {money(v.discount_amount)}</span></div>}
          <div className="grand"><span>Total</span><span>{money(v.total)}</span></div>
        </div>

        <h3>Pagos</h3>
        {(v.visit_payments as { id: string; method_name: string; amount: number }[]).length === 0
          ? <p className="muted">Sin pagos (total en 0).</p>
          : <ul className="plain-list">{(v.visit_payments as { id: string; method_name: string; amount: number }[]).map(p => (
              <li key={p.id}>{p.method_name}: <strong>{money(p.amount)}</strong></li>
            ))}</ul>}

        {v.notes && <><h3>Notas</h3><p>{v.notes}</p></>}
        {voided && <p className="login-error"><strong>Anulado:</strong> {v.void_reason}</p>}
      </section>

      {admin && !voided && (
        <section className="panel wide">
          <h2>Anular cobro</h2>
          <p className="muted">Úsalo solo si el cobro se hizo por error. No se puede anular si el día ya está cerrado.</p>
          <ActionForm action={voidVisit} submitLabel="Anular cobro" buttonClass="btn btn-danger">
            <input type="hidden" name="id" value={v.id} />
            <div className="field"><label htmlFor="reason">Motivo</label><input id="reason" name="reason" required /></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
