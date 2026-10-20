import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { dayTotals } from '@/lib/caja';
import { money } from '@/lib/money';
import { addDays, formatDay, isValidDate, timeOf, toStartsAt, todayStr } from '@/lib/time';

type VisitRow = {
  id: string; total: number; status: string;
  pets: { name: string; owners: { full_name: string } | null } | null;
  visit_payments: { method_name: string; amount: number }[];
};
type Pending = { id: string; starts_at: string; pets: { name: string; owners: { full_name: string } | null } | null };

export default async function CashPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const params = await searchParams;
  const date = isValidDate(params.fecha) ? params.fecha : todayStr();
  const supabase = await createClient();
  const admin = await isAdmin();

  const [{ data: visitData }, { data: pendingData }, totals, closing] = await Promise.all([
    supabase.from('visits')
      .select('id, total, status, pets(name, owners(full_name)), visit_payments(method_name, amount)')
      .eq('visit_date', date).order('created_at'),
    supabase.from('appointments')
      .select('id, starts_at, pets(name, owners(full_name))')
      .eq('status', 'agendada')
      .gte('starts_at', toStartsAt(date, '00:00')).lt('starts_at', toStartsAt(addDays(date, 1), '00:00'))
      .order('starts_at'),
    dayTotals(supabase, date),
    admin ? supabase.from('cash_closings').select('id').eq('closing_date', date).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const visits = (visitData ?? []) as unknown as VisitRow[];
  const pending = (pendingData ?? []) as unknown as Pending[];

  return (
    <>
      <PageHeader
        title="Servicios y caja"
        description="Aquí cobras los servicios del día y ves cuánto entró y con qué medio de pago. Las citas pendientes aparecen abajo con el botón “Atender y cobrar”. Al terminar la jornada, el administrador cierra el día."
      />

      <div className="toolbar">
        <div className="agenda-nav">
          <Link className="btn btn-ghost" href={`/caja?fecha=${addDays(date, -1)}`}>←</Link>
          <Link className="btn btn-ghost" href="/caja">Hoy</Link>
          <Link className="btn btn-ghost" href={`/caja?fecha=${addDays(date, 1)}`}>→</Link>
        </div>
        <div className="agenda-nav">
          {admin && <Link className="btn btn-ghost" href={`/caja/cierre?fecha=${date}`}>{closing.data ? 'Ver cierre del día' : 'Cierre del día'}</Link>}
          {admin && <Link className="btn btn-ghost" href="/caja/reportes">Reportes</Link>}
          <Link className="btn btn-primary" href="/caja/cobrar">Cobrar sin cita</Link>
        </div>
      </div>
      <h2 className="agenda-title">{formatDay(date)} {closing.data && <span className="badge">Día cerrado</span>}</h2>

      <div className="stat-grid">
        <div className="stat"><span className="muted">Servicios cobrados</span><strong>{totals.count}</strong></div>
        <div className="stat"><span className="muted">Total del día</span><strong>{money(totals.total)}</strong></div>
        {Object.entries(totals.byMethod).map(([m, v]) => (
          <div className="stat" key={m}><span className="muted">{m}</span><strong>{money(v)}</strong></div>
        ))}
      </div>

      {pending.length > 0 && (
        <section className="panel wide">
          <h2>Citas pendientes de cobro</h2>
          {pending.map(a => (
            <div className="row-form" key={a.id}>
              <span><strong>{timeOf(a.starts_at)}</strong> · {a.pets?.name} <span className="muted">({a.pets?.owners?.full_name})</span></span>
              <Link className="btn btn-primary" href={`/caja/cobrar?cita=${a.id}`}>Atender y cobrar</Link>
            </div>
          ))}
        </section>
      )}

      {visits.length === 0 ? (
        <EmptyState title="Todavía no hay cobros este día." pet="gato">
          Aquí aparecerán los servicios que cobres. Cobra una cita pendiente o usa “Cobrar sin cita”.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Mascota</th><th>Pago</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {visits.map(v => (
                <tr key={v.id} className={v.status === 'anulado' ? 'row-void' : ''}>
                  <td>
                    <Link href={`/caja/${v.id}`}>{v.pets?.name}</Link> <span className="muted">({v.pets?.owners?.full_name})</span>
                    {v.status === 'anulado' && <> <span className="badge badge-warn">Anulado</span></>}
                  </td>
                  <td>{v.visit_payments.map(p => `${p.method_name} ${money(p.amount)}`).join(' + ') || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{money(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
