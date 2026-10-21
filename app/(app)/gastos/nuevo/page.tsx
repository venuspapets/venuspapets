import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { todayStr } from '@/lib/time';
import { ExpenseForm } from '../ExpenseForm';

export default async function NewExpensePage() {
  const supabase = await requireAdmin();
  const [{ data: categories }, { data: methods }] = await Promise.all([
    supabase.from('expense_categories').select('id, name').eq('active', true).order('sort_order'),
    supabase.from('payment_methods').select('id, name, is_cash').eq('active', true).order('sort_order')
  ]);

  return (
    <>
      <PageHeader
        title="Nuevo gasto"
        description="Anota el gasto con su fecha, categoría y monto. Si lo pagaste con la plata de la caja, deja activado “Salió de la caja”. Puedes adjuntar la foto de la factura."
      />
      <div className="back-bar"><Link className="btn btn-ghost" href="/gastos">← Volver a gastos</Link></div>
      <section className="panel wide">
        {(categories ?? []).length === 0 || (methods ?? []).length === 0
          ? <p className="login-error">Faltan categorías de gastos o medios de pago activos. Créalos en Configuración → Pagos y gastos.</p>
          : <ExpenseForm categories={categories ?? []} methods={methods ?? []} today={todayStr()} />}
      </section>
    </>
  );
}
