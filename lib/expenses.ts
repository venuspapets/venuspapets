import type { SupabaseClient } from '@supabase/supabase-js';

export type CategoryStat = { name: string; amount: number; count: number; pct: number };
export type MethodStat = { name: string; amount: number };

export type FinanceSummary = {
  income: number;          // cobrado por servicios (ya con descuentos aplicados)
  services: number;        // cantidad de servicios cobrados
  discounts: number;       // valor de los descuentos dados (informativo)
  expenses: number;
  expenseCount: number;
  voidedExpenses: number;
  profit: number;
  byCategory: CategoryStat[];
  byMethod: MethodStat[];
};

/** Ingresos, gastos y utilidad entre dos fechas. Los cobros y gastos anulados no cuentan. */
export async function financeSummary(supabase: SupabaseClient, from: string, to: string): Promise<FinanceSummary> {
  const [{ data: visits }, { data: expenses }] = await Promise.all([
    supabase.from('visits').select('total, discount_amount')
      .eq('status', 'cobrado').gte('visit_date', from).lte('visit_date', to),
    supabase.from('expenses').select('amount, category_name, payment_method_name, status')
      .gte('expense_date', from).lte('expense_date', to)
  ]);

  const income = (visits ?? []).reduce((s, v) => s + v.total, 0);
  const discounts = (visits ?? []).reduce((s, v) => s + v.discount_amount, 0);

  const active = (expenses ?? []).filter(e => e.status === 'registrado');
  const total = active.reduce((s, e) => s + e.amount, 0);

  const cats = new Map<string, CategoryStat>();
  const methods = new Map<string, number>();
  for (const e of active) {
    const c = cats.get(e.category_name) ?? { name: e.category_name, amount: 0, count: 0, pct: 0 };
    c.amount += e.amount;
    c.count++;
    cats.set(e.category_name, c);
    const m = e.payment_method_name || 'Sin medio';
    methods.set(m, (methods.get(m) ?? 0) + e.amount);
  }

  return {
    income, services: (visits ?? []).length, discounts,
    expenses: total, expenseCount: active.length,
    voidedExpenses: (expenses ?? []).length - active.length,
    profit: income - total,
    byCategory: [...cats.values()].map(c => ({ ...c, pct: total ? Math.round((c.amount / total) * 1000) / 10 : 0 })).sort((a, b) => b.amount - a.amount),
    byMethod: [...methods.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  };
}
