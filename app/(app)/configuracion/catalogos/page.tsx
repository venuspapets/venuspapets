import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { saveCatalogItem } from '../actions';

type Item = { id: string; name: string; active: boolean };

function Catalog({ title, help, table, items, example }: {
  title: string; help: string; table: string; items: Item[]; example: string;
}) {
  return (
    <section className="panel wide">
      <h2>{title}</h2>
      <p className="muted">{help}</p>
      {items.map(i => (
        <ActionForm key={i.id} action={saveCatalogItem} className="row-form">
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={i.id} />
          <div className="field"><input name="name" defaultValue={i.name} required aria-label="Nombre" /></div>
          <label className="check"><input type="checkbox" name="active" defaultChecked={i.active} /> Activo</label>
        </ActionForm>
      ))}
      <h3>Agregar</h3>
      <ActionForm action={saveCatalogItem} className="row-form" submitLabel="Agregar">
        <input type="hidden" name="table" value={table} />
        <div className="field"><input name="name" placeholder={example} required aria-label="Nuevo nombre" /></div>
      </ActionForm>
    </section>
  );
}

export default async function CatalogsPage() {
  const supabase = await createClient();
  const [{ data: methods }, { data: categories }] = await Promise.all([
    supabase.from('payment_methods').select('id, name, active').order('sort_order'),
    supabase.from('expense_categories').select('id, name, active').order('sort_order')
  ]);

  return (
    <>
      <PageHeader
        title="Pagos y gastos"
        description="Aquí defines con qué se puede pagar un servicio y en qué categorías se clasifican los gastos del negocio (por ejemplo arriendo o insumos). Puedes editar los nombres, agregar más o desactivar los que no uses; lo desactivado deja de aparecer pero el historial se conserva."
      />
      <Catalog
        title="Medios de pago" table="payment_methods" items={methods ?? []} example="ej. Nequi"
        help="Se ofrecen al cobrar un servicio o vender un paquete."
      />
      <Catalog
        title="Categorías de gastos" table="expense_categories" items={categories ?? []} example="ej. Seguros"
        help="Se eligen al registrar un gasto. “Insumos” sirve para champús, perfumes, toallas y demás materiales."
      />
    </>
  );
}
