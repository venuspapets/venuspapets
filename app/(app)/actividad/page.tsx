import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ACTION_LABELS } from '@/lib/activity';
import { addDays, isValidDate, toStartsAt, todayStr } from '@/lib/time';

type Row = { id: string; created_at: string; user_name: string; action: string; summary: string; details: Record<string, unknown> };

const LIMIT = 300;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; accion?: string }> }) {
  const params = await searchParams;
  const today = todayStr();
  const from = isValidDate(params.desde) ? params.desde : addDays(today, -7);
  const to = isValidDate(params.hasta) ? params.hasta : today;
  const action = params.accion && ACTION_LABELS[params.accion] ? params.accion : '';
  const supabase = await requireAdmin();

  let query = supabase.from('activity_log').select('id, created_at, user_name, action, summary, details')
    .gte('created_at', toStartsAt(from, '00:00')).lt('created_at', toStartsAt(addDays(to, 1), '00:00'))
    .order('created_at', { ascending: false }).limit(LIMIT);
  if (action) query = query.eq('action', action);
  const { data } = from > to ? { data: [] } : await query;
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Registro de actividad"
        description="Aquí queda constancia de quién hizo qué y cuándo: cobros, anulaciones, cierres de caja, cambios de precios y de descuentos, citas y clientes. El registro no se puede editar ni borrar. Los cobros con precio modificado o descuento manual aparecen marcados."
      />

      <form action="/actividad" className="toolbar">
        <div className="row-form">
          <div className="field"><label htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={from} /></div>
          <div className="field"><label htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={to} /></div>
          <div className="field">
            <label htmlFor="accion">Tipo</label>
            <select id="accion" name="accion" defaultValue={action}>
              <option value="">Todos</option>
              {Object.entries(ACTION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Filtrar</button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No hay actividad en este rango.">Prueba con otras fechas o con otro tipo. Aquí aparecerá todo lo que se haga en el sistema.</EmptyState>
      ) : (
        <>
          {rows.length === LIMIT && <p className="muted">Se muestran las últimas {LIMIT} acciones del rango. Acota las fechas para ver las anteriores.</p>}
          <div className="table-wrap" style={{ maxWidth: 1100 }}>
            <table className="table">
              <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const hasDetails = Object.keys(r.details ?? {}).length > 0;
                  const flagged = /precio modificado|descuento manual/.test(r.summary);
                  return (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                      <td>{r.user_name}</td>
                      <td>
                        <span className="badge">{ACTION_LABELS[r.action] ?? r.action}</span> {flagged ? <span className="badge badge-warn">Revisar</span> : null}
                        <div>{r.summary}</div>
                        {hasDetails && (
                          <details>
                            <summary className="muted">Ver detalle</summary>
                            <pre className="detail-json">{JSON.stringify(r.details, null, 2)}</pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="muted"><Link href="/caja/reportes">Ver reportes de caja</Link></p>
    </>
  );
}
