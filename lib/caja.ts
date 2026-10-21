import type { SupabaseClient } from '@supabase/supabase-js';
import { groomerName } from '@/lib/appointments';
import { DISCOUNT_TYPE_LABELS } from '@/lib/discounts';
import { addDays } from '@/lib/time';

type PaymentRow = { method_name: string; is_cash: boolean; amount: number };

/** Totales de un día calculados a partir de los cobros no anulados. */
export async function dayTotals(supabase: SupabaseClient, date: string) {
  const { data } = await supabase.from('visits')
    .select('id, total, discount_amount, visit_payments(method_name, is_cash, amount)')
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
  // Gastos pagados con la plata de la caja ese día (solo los ve el administrador).
  const { data: exp } = await supabase.from('expenses').select('amount')
    .eq('expense_date', date).eq('from_cash', true).eq('status', 'registrado');
  const cashExpenses = (exp ?? []).reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

  return {
    count: visits.length,
    total: visits.reduce((s: number, v: { total: number }) => s + v.total, 0),
    discounts: visits.reduce((s: number, v: { discount_amount: number }) => s + v.discount_amount, 0),
    byMethod, cashIncome: expectedCash, cashExpenses, expectedCash: expectedCash - cashExpenses
  };
}

export type ReportDay = {
  date: string; count: number; total: number; byMethod: Record<string, number>; expectedCash: number; cashExpenses: number;
  discountTotal: number; discountByType: Record<string, number>;
  voidedCount: number; voidedAmount: number;
  closed: boolean; counted: number | null; difference: number | null; closedBy: string; notes: string;
};

export type PromoStat = { label: string; count: number; amount: number };

export type Report = {
  days: ReportDay[]; methods: string[]; discountTypes: string[]; promos: PromoStat[];
  totals: {
    count: number; total: number; byMethod: Record<string, number>; expectedCash: number; cashExpenses: number;
    discountTotal: number; discountByType: Record<string, number>; voidedCount: number; voidedAmount: number;
  };
};

const TYPE_ORDER = ['lealtad', 'cumpleanos', 'temporada', 'manual'];

/** Resumen por día entre dos fechas: cobros por medio de pago, descuentos y los datos del cierre, si existe. */
export async function buildReport(supabase: SupabaseClient, from: string, to: string): Promise<Report> {
  const [{ data: visits }, { data: closings }, { data: profiles }, { data: cashExp }] = await Promise.all([
    supabase.from('visits')
      .select('visit_date, total, status, discount_amount, discount_type, discount_label, visit_payments(method_name, is_cash, amount)')
      .gte('visit_date', from).lte('visit_date', to).order('visit_date'),
    supabase.from('cash_closings').select('*').gte('closing_date', from).lte('closing_date', to),
    supabase.from('profiles').select('id, full_name, role'),
    supabase.from('expenses').select('expense_date, amount').eq('from_cash', true).eq('status', 'registrado')
      .gte('expense_date', from).lte('expense_date', to)
  ]);
  const names = new Map((profiles ?? []).map(p => [p.id, groomerName(p)]));

  const days = new Map<string, ReportDay>();
  const promoMap = new Map<string, PromoStat>();
  const day = (date: string): ReportDay => {
    let d = days.get(date);
    if (!d) {
      d = {
        date, count: 0, total: 0, byMethod: {}, expectedCash: 0, cashExpenses: 0, discountTotal: 0, discountByType: {},
        voidedCount: 0, voidedAmount: 0, closed: false, counted: null, difference: null, closedBy: '', notes: ''
      };
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
    if (v.discount_amount > 0) {
      // Cobros anteriores a los tipos de descuento cuentan como manuales.
      const type: string = v.discount_type ?? 'manual';
      d.discountTotal += v.discount_amount;
      d.discountByType[type] = (d.discountByType[type] ?? 0) + v.discount_amount;
      const label = type === 'temporada' ? `Temporada: ${v.discount_label ?? ''}`.trim() : DISCOUNT_TYPE_LABELS[type] ?? type;
      const stat = promoMap.get(label) ?? { label, count: 0, amount: 0 };
      stat.count++;
      stat.amount += v.discount_amount;
      promoMap.set(label, stat);
    }
  }
  for (const e of cashExp ?? []) {
    const d = day(e.expense_date);
    d.cashExpenses += e.amount;
    d.expectedCash -= e.amount;
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
  const usedTypes = new Set(list.flatMap(d => Object.keys(d.discountByType)));
  const discountTypes = TYPE_ORDER.filter(t => usedTypes.has(t));

  const totals: Report['totals'] = {
    count: 0, total: 0, byMethod: {}, expectedCash: 0, cashExpenses: 0, discountTotal: 0, discountByType: {}, voidedCount: 0, voidedAmount: 0
  };
  for (const d of list) {
    totals.count += d.count; totals.total += d.total; totals.expectedCash += d.expectedCash; totals.cashExpenses += d.cashExpenses;
    totals.discountTotal += d.discountTotal;
    totals.voidedCount += d.voidedCount; totals.voidedAmount += d.voidedAmount;
    for (const [m, v] of Object.entries(d.byMethod)) totals.byMethod[m] = (totals.byMethod[m] ?? 0) + v;
    for (const [t, v] of Object.entries(d.discountByType)) totals.discountByType[t] = (totals.discountByType[t] ?? 0) + v;
  }
  const promos = [...promoMap.values()].sort((a, b) => b.amount - a.amount);
  return { days: list, methods, discountTypes, promos, totals };
}

/** Rango por defecto del reporte: desde el día 1 del mes hasta hoy. */
export function defaultRange(today: string) {
  return { from: today.slice(0, 8) + '01', to: today };
}

/** Máximo de días que se permite consultar de una vez. */
export const MAX_RANGE_DAYS = 366;
export const rangeTooLong = (from: string, to: string) => addDays(from, MAX_RANGE_DAYS) < to;
