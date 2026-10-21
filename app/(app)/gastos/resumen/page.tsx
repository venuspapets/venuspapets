import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { defaultRange, rangeTooLong } from '@/lib/caja';
import { financeSummary } from '@/lib/expenses';
import { money } from '@/lib/money';
import { formatShortDay, isValidDate, todayStr } from '@/lib/time';
import { PrintButton } from '../../caja/reportes/PrintButton';

export default async function SummaryPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const params = await searchParams;
  const def = defaultRange(todayStr());
  const from = isValidDate(params.desde) ? params.desde : def.from;
  const to = isValidDate(params.hasta) ? params.hasta : def.to;
  const supabase = await requireAdmin();

  const invalid = from > to ? 'La fecha “desde” no puede ser mayor que “hasta”.' : rangeTooLong(from, to) ? 'Elige un rango de máximo un año.' : null;
  const s = invalid ? null : await financeSummary(supabase, from, to);
  const csv = `/gastos/resumen/csv?desde=${from}&hasta=${to}`;
  const empty = s && s.income === 0 && s.expenses === 0;

  return (
    <>
      <PageHeader
        title="Ingresos, gastos y utilidad"
        description="Elige un rango de fechas para ver cuánto entró por servicios, cuánto se gastó y cuál fue la utilidad (ingresos menos gastos). Abajo ves en qué categorías se fue el dinero. Los cobros y gastos anulados no cuentan."
      />
      <div className="back-bar no-print"><Link className="btn btn-ghost" href="/gastos">← Volver a gastos</Link></div>

      <form action="/gastos/resumen" className="toolbar no-print">
        <div className="row-form">
          <div className="field"><label htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={from} required /></div>
          <div className="field"><label htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={to} required /></div>
          <button className="btn btn-primary" type="submit">Ver resumen</button>
        </div>
        {s && <div className="agenda-nav"><a className="btn btn-ghost" href={csv}>Descargar para Excel</a><PrintButton /></div>}
      </form>

      {invalid && <p className="login-error">{invalid}</p>}

      {empty && <EmptyState title="No hay movimientos en este rango.">Prueba con otras fechas. Los cobros y los gastos aparecerán aquí.</EmptyState>}

      {s && !empty && (
        <>
          <h2 className="agenda-title">Del {formatShortDay(from)} al {formatShortDay(to)}</h2>
          <div className="stat-grid">
            <div className="stat"><span className="muted">Ingresos ({s.services} servicios)</span><strong>{money(s.income)}</strong></div>
            <div className="stat"><span className="muted">Gastos ({s.expenseCount})</span><strong>{money(s.expenses)}</strong></div>
            <div className={s.profit >= 0 ? 'stat stat-good' : 'stat stat-bad'}><span className="muted">Utilidad</span><strong>{money(s.profit)}</strong></div>
          </div>
          <p className="muted">
            Los ingresos ya tienen los descuentos aplicados{s.discounts > 0 && <> (se dieron {money(s.discounts)} en descuentos en este rango)</>}.
            {s.voidedExpenses > 0 && <> Hay {s.voidedExpenses} gasto(s) anulado(s) que no se cuentan.</>}
          </p>

          <section className="panel wide">
            <h2>Gastos por categoría</h2>
            {s.byCategory.length === 0 ? <p className="muted">No hay gastos en este rango.</p> : (
              <table className="table">
                <thead><tr><th>Categoría</th><th>Gastos</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ width: '30%' }}>% del total</th></tr></thead>
                <tbody>
                  {s.byCategory.map(c => (
                    <tr key={c.name}>
                      <td>{c.name}</td><td>{c.count}</td><td style={{ textAlign: 'right' }}>{money(c.amount)}</td>
                      <td><div className="bar"><span style={{ width: `${c.pct}%` }} /></div> <small>{c.pct}%</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {s.byMethod.length > 0 && (
            <section className="panel wide">
              <h2>Gastos por medio de pago</h2>
              <ul className="plain-list">{s.byMethod.map(m => <li key={m.name}>{m.name}: <strong>{money(m.amount)}</strong></li>)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
