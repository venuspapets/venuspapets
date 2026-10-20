import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { saveSize } from '../actions';

export default async function SizesPage() {
  const supabase = await createClient();
  const { data: sizes } = await supabase.from('sizes').select('*').order('sort_order');

  return (
    <>
      <PageHeader
        title="Tamaños de mascota"
        description="Los tamaños definen el precio de cada servicio y cuánto dura una cita. Los minutos son el tiempo base de un baño de ese tamaño; los servicios pueden sumar minutos extra. Puedes editarlos, agregar más o desactivar los que no uses."
      />

      <section className="panel wide">
        <h2>Tamaños</h2>
        {(sizes ?? []).map(s => (
          <ActionForm key={s.id} action={saveSize} className="row-form">
            <input type="hidden" name="id" value={s.id} />
            <div className="field"><label>Nombre</label><input name="name" defaultValue={s.name} required /></div>
            <div className="field"><label>Descripción</label><input name="hint" defaultValue={s.hint} placeholder="hasta ~10 kg" /></div>
            <div className="field"><label>Minutos base</label><input name="base_minutes" inputMode="numeric" defaultValue={s.base_minutes} required /></div>
            <label className="check"><input type="checkbox" name="active" defaultChecked={s.active} /> Activo</label>
          </ActionForm>
        ))}
      </section>

      <section className="panel wide">
        <h2>Agregar tamaño</h2>
        <ActionForm action={saveSize} className="row-form" submitLabel="Agregar">
          <div className="field"><label>Nombre</label><input name="name" required /></div>
          <div className="field"><label>Descripción</label><input name="hint" placeholder="ej. 5 a 8 kg" /></div>
          <div className="field"><label>Minutos base</label><input name="base_minutes" inputMode="numeric" defaultValue="60" required /></div>
        </ActionForm>
      </section>
    </>
  );
}
