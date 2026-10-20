import type { SupabaseClient } from '@supabase/supabase-js';
import { groomerName } from '@/lib/appointments';
import { addDays } from '@/lib/time';

type PaymentRow = { method_name: string; is_cash: boolean; amount: number };

/** Totales de un día calculados a partir de los cobros no anulados. */
export async function dayTotals(supabase: SupabaseClient, date: string) {
  const { data } = await supabase.from('visits')
    .select('id, total, visit_payments(method_name, is_cash, amount)')
    .eq('visit_date', date).eq('status', 'cobrado');
  const visits = data ?? [];
  const byMethod: Record<string, number> = {};
  let expectedCash = 0;
  for (const v of visits) {
    for (const pay of (v.visit_payments ?? []) as PaymentRow[]) {
      byMethod[pay.method_name] = (byMethod[pay.method_name] ?? 0) + pay.amount;
      if (pay.is_cash) expectedCash += pay.amount;
    }
  }
  return { count: visits.length, total: visits.reduce((s: number, v: { total: number }) => s + v.total, 0), byMethod, expectedCash };
}

export type ReportDay = {
  date: string; count: number; total: number; byMethod: Record<string, number>; expectedCash: number;
  voidedCount: number; voidedAmount: number;
  closed: boolean; counted: number | null; difference: number | null; closedBy: string; notes: string;
};

export type Report = {
  days: ReportDay[]; methods: string[];
  totals: { count: number; total: number; byMethod: Record<string, number>; expectedCash: number; voidedCount: number; voidedAmount: number };
};

/** Resumen por día entre dos fechas: cobros por medio de pago más los datos del cierre, si existe. */
export async function buildReport(supabase: SupabaseClient, from: string, to: string): Promise<Report> {
  const [{ data: visits }, { data: closings }, { data: profiles }] = await Promise.all([
    supabase.from('visits')
      .select('visit_date, total, status, visit_payments(method_name, is_cash, amount)')
      .gte('visit_date', from).lte('visit_date', to).order('visit_date'),
    supabase.from('cash_closings').select('*').gte('closing_date', from).lte('closing_date', to),
    supabase.from('profiles').select('id, full_name, role')
  ]);
  const names = new Map((profiles ?? []).map(p => [p.id, groomerName(p)]));

  const days = new Map<string, ReportDay>();
  const day = (date: string): ReportDay => {
    let d = days.get(date);
    if (!d) {
      d = { date, count: 0, total: 0, byMethod: {}, expectedCash: 0, voidedCount: 0, voidedAmount: 0, closed: false, counted: null, difference: null, closedBy: '', notes: '' };
      days.set(date, d);
    }
    return d;
  };

  for (const v of visits ?? []) {
    const d = day(v.visit_date);
    if (v.status === 'anulado') { d.voidedCount++; d.voidedAmount += v.total; continue; }
    d.count++;
    d.total += v.total;
    for (const pay of (v.visit_payments ?? []) as PaymentRow[]) {
      d.byMethod[pay.method_name] = (d.byMethod[pay.method_name] ?? 0) + pay.amount;
      if (pay.is_cash) d.expectedCash += pay.amount;
    }
  }
  for (const c of closings ?? []) {
    const d = day(c.closing_date);
    d.closed = true;
    d.counted = c.counted_cash;
    d.difference = c.difference;
    d.closedBy = c.closed_by ? names.get(c.closed_by) ?? '' : '';
    d.notes = c.notes;
  }

  const list = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const methods = [...new Set(list.flatMap(d => Object.keys(d.byMethod)))].sort();
  const totals: Report['totals'] = { count: 0, total: 0, byMethod: {}, expectedCash: 0, voidedCount: 0, voidedAmount: 0 };
  for (const d of list) {
    totals.count += d.count; totals.total += d.total; totals.expectedCash += d.expectedCash;
    totals.voidedCount += d.voidedCount; totals.voidedAmount += d.voidedAmount;
    for (const [m, v] of Object.entries(d.byMethod)) totals.byMethod[m] = (totals.byMethod[m] ?? 0) + v;
  }
  return { days: list, methods, totals };
}

/** Rango por defecto del reporte: desde el día 1 del mes hasta hoy. */
export function defaultRange(today: string) {
  return { from: today.slice(0, 8) + '01', to: today };
}

/** Máximo de días que se permite consultar de una vez. */
export const MAX_RANGE_DAYS = 366;
export const rangeTooLong = (from: string, to: string) => addDays(from, MAX_RANGE_DAYS) < to;
