import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { priceFor } from '@/lib/pricing';
import { eligibleDiscounts } from '@/lib/discounts';
import { dateOf, formatDay, todayStr } from '@/lib/time';
import { ChargeForm } from './ChargeForm';

export default async function ChargePage({ searchParams }: { searchParams: Promise<{ cita?: string; mascota?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();

  // Sin cita ni mascota: se elige la mascota primero.
  if (!params.cita && !params.mascota) {
    const { data: pets } = await supabase.from('pets').select('id, name, owners(full_name)').eq('active', true).order('name');
    return (
      <>
        <PageHeader
          title="Cobrar un servicio"
          description="Para cobrar a un cliente que llegó sin cita, elige primero a la mascota. Si tiene cita agendada, es más rápido entrar a la cita y pulsar “Atender y cobrar”."
        />
        <section className="panel wide">
          <form action="/caja/cobrar" className="row-form">
            <div className="field">
              <label htmlFor="mascota">Mascota</label>
              <select id="mascota" name="mascota" required>
                <option value="">— Elige una mascota —</option>
                {(pets ?? []).map(p => <option key={p.id} value={p.id}>{p.name} ({(p.owners as unknown as { full_name: string } | null)?.full_name})</option>)}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Continuar</button>
          </form>
        </section>
      </>
    );
  }

  let appt: { id: string; pet_id: string; starts_at: string; groomer_id: string | null; appointment_services: { service_id: string }[] } | null = null;
  if (params.cita) {
    const { data } = await supabase.from('appointments').select('id, pet_id, starts_at, groomer_id, appointment_services(service_id)').eq('id', params.cita).maybeSingle();
    if (!data) notFound();
    appt = data;
    const { data: done } = await supabase.from('visits').select('id').eq('appointment_id', appt.id).eq('status', 'cobrado').maybeSingle();
    if (done) redirect(`/caja/${done.id}`);
  }

  const petId = appt?.pet_id ?? params.mascota!;
  const [{ data: pet }, { data: services }, { data: methods }, { data: { user } }] = await Promise.all([
    supabase.from('pets').select('id, name, breed, size_id, birthdate, owners(full_name), sizes(name)').eq('id', petId).maybeSingle(),
    supabase.from('services').select('id, name, service_prices(size_id, price), service_breed_prices(breed, price)').eq('active', true).order('name'),
    supabase.from('payment_methods').select('id, name').eq('active', true).order('sort_order'),
    supabase.auth.getUser()
  ]);
  if (!pet) notFound();

  const catalog = (services ?? []).map(s => ({ id: s.id, name: s.name, price: priceFor(s, pet) }));
  const initial = (appt?.appointment_services ?? [])
    .map(a => catalog.find(c => c.id === a.service_id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map(c => ({ service_id: c.id, name: c.name, price: c.price ?? 0 }));
  const visitDate = appt ? dateOf(appt.starts_at) : todayStr();
  const discounts = await eligibleDiscounts(supabase, pet, visitDate);
  const owner = pet.owners as unknown as { full_name: string } | null;
  const size = pet.sizes as unknown as { name: string } | null;

  return (
    <>
      <PageHeader
        title={`Cobrar a ${pet.name}`}
        description="Revisa los servicios y sus precios (puedes cambiar el valor de una línea o agregar más), aplica un descuento en porcentaje si corresponde y elige cómo pagó el cliente. Si pagó con varios medios, usa “Pagar con otro medio”."
      />
      <div className="back-bar">
        <Link className="btn btn-ghost" href="/caja">← Volver a caja</Link>
        <span className="muted">{owner?.full_name}{size && ` · ${size.name}`} · {formatDay(visitDate)}</span>
      </div>
      {(methods ?? []).length === 0 ? (
        <p className="login-error">No hay medios de pago activos. Créalos en Configuración → Pagos y gastos.</p>
      ) : (
        <section className="panel wide">
          <ChargeForm
            petId={pet.id} appointmentId={appt?.id ?? null} groomerId={appt?.groomer_id ?? user?.id ?? ''} visitDate={visitDate}
            catalog={catalog} methods={methods ?? []} initial={initial}
            petName={pet.name} bathNumber={discounts.bathNumber} suggestions={discounts.options} best={discounts.best}
          />
        </section>
      )}
    </>
  );
}
