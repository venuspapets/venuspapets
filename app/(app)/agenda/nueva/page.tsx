import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { isValidDate, todayStr } from '@/lib/time';
import { AppointmentForm } from '../AppointmentForm';
import { loadFormOptions } from '../options';

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ fecha?: string; hora?: string; mascota?: string }> }) {
  const params = await searchParams;
  const { pets, services, groomers, currentUserId } = await loadFormOptions();
  const date = isValidDate(params.fecha) ? params.fecha : todayStr();
  const time = /^\d{2}:\d{2}$/.test(params.hora ?? '') ? params.hora! : '09:00';

  return (
    <>
      <PageHeader
        title="Nueva cita"
        description="Elige la mascota, la fecha, la hora y los servicios. La duración se calcula sola según el tamaño y los servicios, pero puedes cambiarla. Si la cita queda muy cerca de otra o fuera del horario, te avisaremos y tú decides si agendarla igual."
      />
      <p><Link href={`/agenda?fecha=${date}`}>← Volver a la agenda</Link></p>

      {pets.length === 0 ? (
        <EmptyState title="Primero registra una mascota" pet="gato">
          Para agendar una cita necesitas al menos un cliente con su mascota. Créalos en <Link href="/clientes/nuevo">Clientes</Link>.
        </EmptyState>
      ) : (
        <section className="panel wide">
          <AppointmentForm
            pets={pets} services={services} groomers={groomers}
            values={{
              pet_id: params.mascota ?? '', date, time, duration: 60,
              groomer_id: groomers.find(g => g.id === currentUserId)?.id ?? groomers[0]?.id ?? '',
              service_ids: [], notes: '', status: 'agendada'
            }}
          />
        </section>
      )}
    </>
  );
}
