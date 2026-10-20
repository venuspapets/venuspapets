import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { statusLabel } from '@/lib/appointments';
import { addDays, addMinutesIso, formatDay, timeOf, toStartsAt, todayStr } from '@/lib/time';

type Appt = { id: string; starts_at: string; duration_minutes: number; status: string; pets: { name: string; owners: { full_name: string } | null } | null };

export default async function Home() {
  const supabase = await createClient();
  const today = todayStr();
  const { data } = await supabase.from('appointments')
    .select('id, starts_at, duration_minutes, status, pets(name, owners(full_name))')
    .gte('starts_at', toStartsAt(today, '00:00'))
    .lt('starts_at', toStartsAt(addDays(today, 1), '00:00'))
    .order('starts_at');
  const appts = (data ?? []) as unknown as Appt[];

  return (
    <>
      <PageHeader
        title="Inicio"
        description="Este es el panel principal. Aquí ves las citas de hoy y los accesos rápidos. Desde el menú de la izquierda entras a cada módulo; empieza por Configuración para dejar listos tus servicios, precios y horario."
      />

      <section className="hero">
        <img src="/perro.svg" alt="" width={110} height={110} />
        <div>
          <h2>¡Bienvenido a VenuSpa Pets!</h2>
          <p>Hoy es {formatDay(today)}.</p>
        </div>
        <img src="/gato.svg" alt="" width={110} height={110} />
      </section>

      <div className="quick-grid">
        <Link href="/agenda/nueva" className="quick"><img src="/perro.svg" alt="" width={44} height={44} /><span>Agendar cita</span></Link>
        <Link href="/clientes/nuevo" className="quick"><img src="/gato.svg" alt="" width={44} height={44} /><span>Nuevo cliente</span></Link>
        <Link href="/agenda" className="quick"><img src="/perro.svg" alt="" width={44} height={44} /><span>Ver agenda</span></Link>
      </div>

      <section className="panel wide">
        <h2>Citas de hoy</h2>
        {appts.length === 0 ? (
          <div className="empty-inline">
            <img src="/gato.svg" alt="" width={64} height={64} />
            <p className="muted">No hay citas para hoy. <Link href="/agenda/nueva">Agenda la primera</Link>.</p>
          </div>
        ) : (
          <ul className="today-list">
            {appts.map(a => (
              <li key={a.id}>
                <Link href={`/agenda/${a.id}`}>
                  <strong>{timeOf(a.starts_at)} – {timeOf(addMinutesIso(a.starts_at, a.duration_minutes))}</strong> · {a.pets?.name}
                  <span className="muted"> ({a.pets?.owners?.full_name})</span>
                </Link>
                {a.status !== 'agendada' && <span className="badge">{statusLabel(a.status)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
