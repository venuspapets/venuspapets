import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { saveBusiness } from './actions';

export default async function BusinessPage() {
  const supabase = await createClient();
  const { data: s } = await supabase.from('settings').select('*').single();

  return (
    <>
      <PageHeader
        title="Configuración del negocio"
        description="Aquí defines los datos de tu peluquería. El WhatsApp del dueño se usa para avisarte de las citas nuevas y para el resumen de la agenda."
      />
      <section className="panel">
        <ActionForm action={saveBusiness}>
          <div className="field">
            <label htmlFor="business_name">Nombre del negocio</label>
            <input id="business_name" name="business_name" defaultValue={s?.business_name ?? ''} required />
          </div>
          <div className="field">
            <label htmlFor="owner_name">Nombre del dueño</label>
            <input id="owner_name" name="owner_name" defaultValue={s?.owner_name ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="owner_phone">WhatsApp del dueño</label>
            <input id="owner_phone" name="owner_phone" inputMode="tel" defaultValue={s?.owner_phone ?? ''} placeholder="3001234567" />
            <small className="muted">Escríbelo con 10 dígitos; el indicativo de Colombia (57) se agrega solo.</small>
          </div>
          <div className="field">
            <label htmlFor="address">Dirección</label>
            <input id="address" name="address" defaultValue={s?.address ?? ''} />
          </div>
        </ActionForm>
      </section>
    </>
  );
}
