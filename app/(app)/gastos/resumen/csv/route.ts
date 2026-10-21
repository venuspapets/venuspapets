import { createClient } from '@/lib/supabase/server';
import { rangeTooLong } from '@/lib/caja';
import { financeSummary } from '@/lib/expenses';
import { isValidDate } from '@/lib/time';

/** Resumen de ingresos, gastos y utilidad en CSV (separador ;) para Excel. Solo administrador. */
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

  const s = await financeSummary(supabase, from, to);
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [
    ['Resumen', `${from} a ${to}`],
    ['Ingresos por servicios', s.income],
    ['Servicios cobrados', s.services],
    ['Descuentos dados', s.discounts],
    ['Gastos', s.expenses],
    ['Utilidad', s.profit],
    [],
    ['Categoría de gasto', 'Cantidad', 'Valor', '% del total'],
    ...s.byCategory.map(c => [c.name, c.count, c.amount, c.pct]),
    [],
    ['Medio de pago', 'Valor'],
    ...s.byMethod.map(m => [m.name, m.amount])
  ];

  const body = '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="utilidad-${from}_a_${to}.csv"`
    }
  });
}
