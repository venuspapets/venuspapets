import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { defaultRange, rangeTooLong } from '@/lib/caja';
import { money } from '@/lib/money';
import { formatShortDay, isValidDate, todayStr } from '@/lib/time';

type Row = {
  id: string; expense_date: string; category_name: string; description: string; amount: number;
  payment_method_name: string; from_cash: boolean; supplier: string; receipt_path: string | null; status: string;
};

const LIMIT = 500;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; categoria?: string }> }) {
  const params = await searchParams;
  const def = defaultRange(todayStr());
  const from = isValidDate(params.desde) ? params.desde : def.from;
  const to = isValidDate(params.hasta) ? params.hasta : def.to;
  const supabase = await requireAdmin();

  const invalid = from > to ? 'La fecha “desde” no puede ser mayor que “hasta”.' : rangeTooLong(from, to) ? 'Elige un rango de máximo un año.' : null;
  const { data: categories } = await supabase.from('expense_categories').select('id, name').order('sort_order');
  const category = (categories ?? []).some(c => c.id === params.categoria) ? params.categoria! : '';

  let rows: Row[] = [];
  if (!invalid) {
    let q = supabase.from('expenses')
      .select('id, expense_date, category_name, description, amount, payment_method_name, from_cash, supplier, receipt_path, status')
      .gte('expense_date', from).lte('expense_date', to)
      .order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(LIMIT);
    if (category) q = q.eq('category_id', category);
    rows = ((await q).data ?? []) as Row[];
  }
  const active = rows.filter(r => r.status === 'registrado');
  const total = active.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Aquí registras lo que gasta el negocio: arriendo, servicios, insumos, sueldos y demás. Cada gasto lleva su categoría, el medio de pago y, si quieres, el comprobante. Si un gasto se pagó con la plata de la caja, márcalo para que el cierre del día lo descuente. Los gastos no se borran: se anulan con un motivo."
      />

      <div className="toolbar">
        <form action="/gastos" className="row-form">
          <div className="field"><label htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={from} /></div>
          <div className="field"><label htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={to} /></div>
          <div className="field">
            <label htmlFor="categoria">Categoría</label>
            <select id="categoria" name="categoria" defaultValue={category}>
              <option value="">Todas</option>
              {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-ghost" type="submit">Filtrar</button>
        </form>
        <div className="agenda-nav">
          <Link className="btn btn-ghost" href={`/gastos/resumen?desde=${from}&hasta=${to}`}>Ingresos y utilidad</Link>
          <Link className="btn btn-primary" href="/gastos/nuevo">Nuevo gasto</Link>
        </div>
      </div>

      {invalid && <p className="login-error">{invalid}</p>}

      {!invalid && (
        <div className="stat-grid">
          <div className="stat"><span className="muted">Gastos en el rango</span><strong>{money(total)}</strong></div>
          <div className="stat"><span className="muted">Cantidad</span><strong>{active.length}</strong></div>
        </div>
      )}

      {!invalid && rows.length === 0 && (
        <EmptyState title="No hay gastos en este rango." pet="gato">
          Aquí aparecerán los gastos que registres. Pulsa “Nuevo gasto” para anotar el primero.
        </EmptyState>
      )}

      {rows.length > 0 && (
        <>
          {rows.length === LIMIT && <p className="muted">Se muestran los últimos {LIMIT} gastos del rango. Acota las fechas para ver los anteriores.</p>}
          <div className="table-wrap" style={{ maxWidth: 1100 }}>
            <table className="table">
              <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Pago</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={r.status === 'anulado' ? 'row-void' : ''}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatShortDay(r.expense_date)}</td>
                    <td>
                      <Link href={`/gastos/${r.id}`}>{r.description}</Link>
                      {r.supplier && <span className="muted"> · {r.supplier}</span>}
                      {r.receipt_path && <span className="badge"> Comprobante</span>}
                      {r.status === 'anulado' && <> <span className="badge badge-warn">Anulado</span></>}
                    </td>
                    <td>{r.category_name}</td>
                    <td>{r.payment_method_name}{r.from_cash && <span className="muted"> · de la caja</span>}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
