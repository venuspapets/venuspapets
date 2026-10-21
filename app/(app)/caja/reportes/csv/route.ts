import { createClient } from '@/lib/supabase/server';
import { buildReport, rangeTooLong } from '@/lib/caja';
import { DISCOUNT_TYPE_LABELS } from '@/lib/discounts';
import { isValidDate } from '@/lib/time';

/** Reporte de caja en CSV (separador ;) para abrir directo en Excel. Solo administrador. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('role, active').eq('id', user.id).single()
    : { data: null };
  if (!profile?.active || profile.role !== 'admin') return new Response('No autorizado', { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('desde') ?? '';
  const to = searchParams.get('hasta') ?? '';
  if (!isValidDate(from) || !isValidDate(to) || from > to || rangeTooLong(from, to)) {
    return new Response('Rango de fechas no válido', { status: 400 });
  }

  const r = await buildReport(supabase, from, to);
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [
    ['Fecha', 'Servicios', 'Anulados', 'Total', 'Descuentos', ...r.methods, ...r.discountTypes.map(t => 'Desc. ' + DISCOUNT_TYPE_LABELS[t]), 'Gastos de caja', 'Efectivo esperado', 'Efectivo contado', 'Diferencia', 'Cierre', 'Cerrado por', 'Notas'],
    ...r.days.map(d => [
      d.date, d.count, d.voidedCount, d.total, d.discountTotal, ...r.methods.map(m => d.byMethod[m] ?? 0), ...r.discountTypes.map(t => d.discountByType[t] ?? 0),
      d.cashExpenses, d.expectedCash, d.counted ?? '', d.difference ?? '', d.closed ? 'Cerrado' : 'Sin cerrar', d.closedBy, d.notes
    ]),
    ['TOTAL', r.totals.count, r.totals.voidedCount, r.totals.total, r.totals.discountTotal, ...r.methods.map(m => r.totals.byMethod[m] ?? 0), ...r.discountTypes.map(t => r.totals.discountByType[t] ?? 0), r.totals.cashExpenses, r.totals.expectedCash, '', '', '', '', ''],
    [],
    ['Descuentos por tipo y promoción', 'Veces', 'Valor'],
    ...r.promos.map(p => [p.label, p.count, p.amount])
  ];

  const body = '﻿' + rows.map(row => row.map(cell).join(';')).join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="caja-${from}_a_${to}.csv"`
    }
  });
}
