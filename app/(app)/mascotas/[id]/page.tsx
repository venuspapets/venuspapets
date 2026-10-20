import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { formatDate } from '@/lib/pets';
import { addVaccine, removeVaccine } from '../../clientes/actions';
import { PetForm, type PetRow } from '../../clientes/PetForm';

export default async function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: pet }, { data: sizes }, { data: vaccines }] = await Promise.all([
    supabase.from('pets').select('*, owners(id, full_name)').eq('id', id).maybeSingle(),
    supabase.from('sizes').select('id, name, hint').order('sort_order'),
    supabase.from('vaccines').select('*').eq('pet_id', id).order('next_due', { ascending: true, nullsFirst: false })
  ]);
  if (!pet) notFound();

  const photoUrl = pet.photo_path
    ? (await supabase.storage.from('pet-photos').createSignedUrl(pet.photo_path, 3600)).data?.signedUrl
    : null;
  const owner = pet.owners as { id: string; full_name: string };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title={pet.name}
        description="Ficha de la mascota: datos, cuidados especiales, foto y vacunas. Registra la fecha de la próxima vacuna para que el sistema pueda recordársela al dueño."
      />
      <p><Link href={`/clientes/${owner.id}`}>← {owner.full_name}</Link></p>

      <section className="panel wide">
        <h2>Datos de la mascota</h2>
        {photoUrl && <img className="pet-photo" src={photoUrl} alt={`Foto de ${pet.name}`} />}
        <PetForm ownerId={owner.id} pet={pet as PetRow} sizes={sizes ?? []} />
      </section>

      <section className="panel wide">
        <h2>Vacunas</h2>
        {(vaccines ?? []).length === 0 && <p className="muted">Sin vacunas registradas.</p>}
        {(vaccines ?? []).map(v => (
          <ActionForm key={v.id} action={removeVaccine} submitLabel="Quitar" buttonClass="btn btn-ghost" className="row-form">
            <input type="hidden" name="id" value={v.id} />
            <span>
              <strong>{v.name}</strong>
              {v.applied_on && <> · aplicada {formatDate(v.applied_on)}</>}
              {v.next_due && <> · próxima {formatDate(v.next_due)} {v.next_due < today && <span className="badge badge-warn">Vencida</span>}</>}
            </span>
          </ActionForm>
        ))}
        <h3>Agregar vacuna</h3>
        <ActionForm action={addVaccine} submitLabel="Agregar vacuna" className="row-form">
          <input type="hidden" name="pet_id" value={id} />
          <div className="field"><label>Vacuna</label><input name="name" placeholder="ej. Rabia" required /></div>
          <div className="field"><label>Fecha de aplicación</label><input name="applied_on" type="date" /></div>
          <div className="field"><label>Próxima dosis</label><input name="next_due" type="date" /></div>
        </ActionForm>
      </section>
    </>
  );
}
