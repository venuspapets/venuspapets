import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { whatsappUrl } from '@/lib/phone';
import { dateOf, formatDay, timeOf } from '@/lib/time';
import { AppointmentForm } from '../AppointmentForm';
import { loadFormOptions } from '../options';

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: appt }, options] = await Promise.all([
    supabase.from('appointments')
      .select('*, pets(id, name, owners(id, full_name, whatsapp)), appointment_services(service_id)')
      .eq('id', id).maybeSingle(),
    loadFormOptions()
  ]);
  if (!appt) notFound();

  const pet = appt.pets as unknown as { id: string; name: string; owners: { id: string; full_name: string; whatsapp: string } };
  const date = dateOf(appt.starts_at);
  const time = timeOf(appt.starts_at);
  const serviceIds = (appt.appointment_services as { service_id: string }[]).map(s => s.service_id);

  // Si la mascota ya no está activa, igual debe aparecer para poder editar la cita.
  const pets = options.pets.some(p => p.id === pet.id)
    ? options.pets
    : [...options.pets, { id: pet.id, label: `${pet.name} (${pet.owners.full_name})`, baseMinutes: 60 }];

  const reminder = `Hola ${pet.owners.full_name.split(' ')[0]}, te recordamos la cita de ${pet.name} el ${formatDay(date)} a las ${time}. ¡Los esperamos!`;

  return (
    <>
      <PageHeader
        title={`Cita de ${pet.name}`}
        description="Cambia la fecha, la hora, los servicios o el estado de la cita. Marca “Cancelada” o “No asistió” en lugar de borrarla, así queda en el historial."
      />
      <div className="back-bar">
        <Link className="btn btn-ghost" href={`/agenda?fecha=${date}`}>← Volver a la agenda</Link>
        <Link className="btn btn-ghost" href={`/clientes/${pet.owners.id}`}>{pet.owners.full_name}</Link>
        {pet.owners.whatsapp && <a className="btn btn-ghost" href={whatsappUrl(pet.owners.whatsapp, reminder)} target="_blank" rel="noopener noreferrer">Recordar por WhatsApp</a>}
      </div>
      {appt.status === 'agendada' && (
        <p><Link className="btn btn-primary" href={`/caja/cobrar?cita=${appt.id}`}>Atender y cobrar</Link></p>
      )}
      <section className="panel wide">
        <AppointmentForm
          pets={pets} services={options.services} groomers={options.groomers}
          values={{
            id: appt.id, pet_id: appt.pet_id, date, time, duration: appt.duration_minutes,
            groomer_id: appt.groomer_id ?? options.groomers[0]?.id ?? '', service_ids: serviceIds,
            notes: appt.notes, status: appt.status
          }}
        />
      </section>
    </>
  );
}
