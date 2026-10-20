import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { buildReport, defaultRange, rangeTooLong } from '@/lib/caja';
import { money } from '@/lib/money';
import { formatShortDay, isValidDate, todayStr } from '@/lib/time';
import { PrintButton } from './PrintButton';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const params = await searchParams;
  const def = defaultRange(todayStr());
  const from = isValidDate(params.desde) ? params.desde : def.from;
  const to = isValidDate(params.hasta) ? params.hasta : def.to;
  const supabase = await requireAdmin();

  const invalid = from > to ? 'La fecha “desde” no puede ser mayor que “hasta”.' : rangeTooLong(from, to) ? 'Elige un rango de máximo un año.' : null;
  const report = invalid ? null : await buildReport(supabase, from, to);
  const csv = `/caja/reportes/csv?desde=${from}&hasta=${to}`;

  return (
    <>
      <PageHeader
        title="Reportes de caja"
        description="Elige un rango de fechas para ver, día por día, cuántos servicios se cobraron, el total, lo recibido por cada medio de pago y los datos del cierre (efectivo contado y diferencia). Puedes descargarlo para Excel o imprimirlo."
      />
      <p className="no-print"><Link href="/caja">← Volver a caja</Link></p>

      <form action="/caja/reportes" className="toolbar no-print">
        <div className="row-form">
          <div className="field"><label htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={from} required /></div>
          <div className="field"><label htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={to} required /></div>
          <button className="btn btn-primary" type="submit">Ver reporte</button>
        </div>
        {report && <div className="agenda-nav"><a className="btn btn-ghost" href={csv}>Descargar para Excel</a><PrintButton /></div>}
      </form>

      {invalid && <p className="login-error">{invalid}</p>}

      {report && report.days.length === 0 && (
        <EmptyState title="No hay movimientos en este rango.">Prueba con otras fechas. Los cobros y cierres aparecerán aquí.</EmptyState>
      )}

      {report && report.days.length > 0 && (
        <>
          <h2 className="agenda-title">Del {formatShortDay(from)} al {formatShortDay(to)}</h2>
          <div className="table-wrap report">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Servicios</th><th>Total</th>
                  {report.methods.map(m => <th key={m}>{m}</th>)}
                  <th>Efectivo esperado</th><th>Efectivo contado</th><th>Diferencia</th><th>Cierre</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map(d => (
                  <tr key={d.date}>
                    <td><Link href={`/caja?fecha=${d.date}`}>{formatShortDay(d.date)}</Link></td>
                    <td>{d.count}{d.voidedCount > 0 && <span className="muted"> (+{d.voidedCount} anulado{d.voidedCount > 1 ? 's' : ''})</span>}</td>
                    <td>{money(d.total)}</td>
                    {report.methods.map(m => <td key={m}>{money(d.byMethod[m] ?? 0)}</td>)}
                    <td>{money(d.expectedCash)}</td>
                    <td>{d.counted === null ? '—' : money(d.counted)}</td>
                    <td className={d.difference ? 'msg-error' : ''}>{d.difference === null ? '—' : money(d.difference)}</td>
                    <td>{d.closed ? `Cerrado${d.closedBy ? ` por ${d.closedBy}` : ''}` : <span className="muted">Sin cerrar</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th><th>{report.totals.count}</th><th>{money(report.totals.total)}</th>
                  {report.methods.map(m => <th key={m}>{money(report.totals.byMethod[m] ?? 0)}</th>)}
                  <th>{money(report.totals.expectedCash)}</th><th /><th /><th />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
}
