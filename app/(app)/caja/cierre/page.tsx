import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { dayTotals } from '@/lib/caja';
import { money } from '@/lib/money';
import { formatDay, isValidDate, todayStr } from '@/lib/time';
import { ClosingForm } from './ClosingForm';

export default async function ClosingPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const params = await searchParams;
  const date = isValidDate(params.fecha) ? params.fecha : todayStr();
  const supabase = await requireAdmin();

  const [totals, { data: closing }, { count: voided }] = await Promise.all([
    dayTotals(supabase, date),
    supabase.from('cash_closings').select('*').eq('closing_date', date).maybeSingle(),
    supabase.from('visits').select('id', { count: 'exact', head: true }).eq('visit_date', date).eq('status', 'anulado')
  ]);

  return (
    <>
      <PageHeader
        title="Cierre del día"
        description="Aquí revisas lo cobrado en el día por cada medio de pago y cuentas el efectivo que hay en la caja. El sistema calcula la diferencia. Al cerrar, el día queda guardado y no se pueden cobrar ni anular servicios en esa fecha, salvo que lo reabras."
      />
      <div className="back-bar"><Link className="btn btn-ghost" href={`/caja?fecha=${date}`}>← Volver a caja</Link><Link className="btn btn-ghost" href="/caja/reportes">Ver reportes</Link></div>
      <h2 className="agenda-title">{formatDay(date)}</h2>

      <section className="panel wide">
        <div className="stat-grid">
          <div className="stat"><span className="muted">Servicios cobrados</span><strong>{totals.count}</strong></div>
          <div className="stat"><span className="muted">Total del día</span><strong>{money(totals.total)}</strong></div>
          {Object.entries(totals.byMethod).map(([m, v]) => (
            <div className="stat" key={m}><span className="muted">{m}</span><strong>{money(v)}</strong></div>
          ))}
        </div>
        <p className="muted">
          Efectivo cobrado {money(totals.cashIncome)}{totals.cashExpenses > 0 && <> − gastos pagados de la caja {money(totals.cashExpenses)}</>} = <strong>{money(totals.expectedCash)}</strong> esperados en la caja.
        </p>
        {(voided ?? 0) > 0 && <p className="muted">Cobros anulados este día: {voided} (no cuentan en los totales).</p>}

        <ClosingForm
          date={date} expectedCash={totals.expectedCash}
          closing={closing ? { counted: closing.counted_cash, difference: closing.difference, notes: closing.notes, closedAt: closing.closed_at } : null}
        />
      </section>
    </>
  );
}
