import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { PetForm } from '../../../PetForm';

export default async function NewPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: owner }, { data: sizes }] = await Promise.all([
    supabase.from('owners').select('id, full_name').eq('id', id).maybeSingle(),
    supabase.from('sizes').select('id, name, hint').eq('active', true).order('sort_order')
  ]);
  if (!owner) notFound();

  return (
    <>
      <PageHeader
        title="Nueva mascota"
        description={`Registra a la mascota de ${owner.full_name}. El tamaño define el precio de los servicios y la duración de la cita; las alergias y el temperamento ayudan al groomer a atenderla bien.`}
      />
      <p><Link href={`/clientes/${id}`}>← Volver al cliente</Link></p>
      <section className="panel wide">
        <PetForm ownerId={id} sizes={sizes ?? []} />
      </section>
    </>
  );
}
