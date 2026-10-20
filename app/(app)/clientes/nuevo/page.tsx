import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { OwnerForm } from '../OwnerForm';

export default async function NewClientPage() {
  const supabase = await createClient();
  const { data: others } = await supabase.from('owners').select('id, full_name').eq('active', true).order('full_name');

  return (
    <>
      <PageHeader
        title="Nuevo cliente"
        description="Registra los datos del dueño. Al guardar podrás agregar sus mascotas. El WhatsApp se usa para los recordatorios; escríbelo con 10 dígitos."
      />
      <section className="panel wide">
        <OwnerForm others={others ?? []} />
      </section>
    </>
  );
}
