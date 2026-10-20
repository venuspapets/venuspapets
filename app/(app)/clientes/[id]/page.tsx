import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ageLabel } from '@/lib/pets';
import { whatsappUrl } from '@/lib/phone';
import { OwnerForm, type OwnerRow } from '../OwnerForm';

type PetItem = { id: string; name: string; breed: string; birthdate: string | null; active: boolean; sizes: { name: string } | null };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: owner }, { data: pets }, { data: others }] = await Promise.all([
    supabase.from('owners').select('*').eq('id', id).maybeSingle(),
    supabase.from('pets').select('id, name, breed, birthdate, active, sizes(name)').eq('owner_id', id).order('name'),
    supabase.from('owners').select('id, full_name').eq('active', true).order('full_name')
  ]);
  if (!owner) notFound();
  const petList = (pets ?? []) as unknown as PetItem[];

  return (
    <>
      <PageHeader
        title={owner.full_name}
        description="Datos del cliente y sus mascotas. Edita la información y guarda, o agrega una mascota nueva. Si el cliente ya no viene, desmarca “Cliente activo” en lugar de borrarlo."
      />
      <div className="back-bar">
        <Link className="btn btn-ghost" href="/clientes">← Volver a clientes</Link>
        {owner.whatsapp && <a className="btn btn-ghost" href={whatsappUrl(owner.whatsapp)} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>}
      </div>

      <section className="panel wide">
        <h2>Mascotas</h2>
        {petList.length === 0 && <p className="muted">Este cliente todavía no tiene mascotas registradas.</p>}
        <div className="pet-grid">
          {petList.map(p => (
            <Link key={p.id} href={`/mascotas/${p.id}`} className="pet-card">
              <strong>{p.name}</strong> {!p.active && <span className="badge">Inactiva</span>}
              <span className="muted">{[p.breed, p.sizes?.name, ageLabel(p.birthdate)].filter(Boolean).join(' · ')}</span>
            </Link>
          ))}
        </div>
        <p><Link className="btn btn-primary" href={`/clientes/${id}/mascotas/nueva`}>Agregar mascota</Link></p>
      </section>

      <section className="panel wide">
        <h2>Datos del cliente</h2>
        <OwnerForm owner={owner as OwnerRow} others={others ?? []} />
      </section>
    </>
  );
}
