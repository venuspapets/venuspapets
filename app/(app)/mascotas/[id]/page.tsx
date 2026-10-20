import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { PetForm, type PetRow } from '../../clientes/PetForm';

export default async function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: pet }, { data: sizes }] = await Promise.all([
    supabase.from('pets').select('*, owners(id, full_name)').eq('id', id).maybeSingle(),
    supabase.from('sizes').select('id, name, hint').order('sort_order')
  ]);
  if (!pet) notFound();

  const photoUrl = pet.photo_path
    ? (await supabase.storage.from('pet-photos').createSignedUrl(pet.photo_path, 3600)).data?.signedUrl
    : null;
  const owner = pet.owners as { id: string; full_name: string };

  return (
    <>
      <PageHeader
        title={pet.name}
        description="Ficha de la mascota: raza, tamaño, temperamento, alergias, corte preferido y foto. El tamaño define el precio de los servicios; “Baño cada” sirve para avisarle al dueño cuando le toca volver."
      />
      <p><Link href={`/clientes/${owner.id}`}>← {owner.full_name}</Link></p>

      <section className="panel wide">
        <h2>Datos de la mascota</h2>
        {photoUrl && <img className="pet-photo" src={photoUrl} alt={`Foto de ${pet.name}`} />}
        <PetForm ownerId={owner.id} pet={pet as PetRow} sizes={sizes ?? []} />
      </section>
    </>
  );
}
