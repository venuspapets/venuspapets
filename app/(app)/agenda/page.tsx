import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { normalizeHours } from '@/lib/hours';
import { statusLabel } from '@/lib/appointments';
import {
  addDays, addMinutesIso, formatDay, formatShortDay, fromMinutes, isValidDate, timeOf,
  toMinutes, toStartsAt, todayStr, weekStart, weekday, dateOf
} from '@/lib/time';

type Appt = {
  id: string; starts_at: string; duration_minutes: number; status: string;
  pets: { name: string; owners: { full_name: string } | null } | null;
  appointment_services: { services: { name: string } | null }[];
};

function ApptCard({ a }: { a: Appt }) {
  const services = a.appointment_services.map(s => s.services?.name).filter(Boolean).join(', ');
  return (
    <Link href={`/agenda/${a.id}`} className={`appt appt-${a.status}`}>
      <strong>{timeOf(a.starts_at)} – {timeOf(addMinutesIso(a.starts_at, a.duration_minutes))} · {a.pets?.name}</strong>
      <span>{a.pets?.owners?.full_name}</span>
      {services && <span className="muted">{services}</span>}
      {a.status !== 'agendada' && <span className="badge">{statusLabel(a.status)}</span>}
    </Link>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ fecha?: string; vista?: string }> }) {
  const params = await searchParams;
  const date = isValidDate(params.fecha) ? params.fecha : todayStr();
  const week = params.vista === 'semana';
  const supabase = await createClient();

  const from = week ? weekStart(date) : date;
  const days = week ? 7 : 1;
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from('appointments')
      .select('id, starts_at, duration_minutes, status, pets(name, owners(full_name)), appointment_services(services(name))')
      .gte('starts_at', toStartsAt(from, '00:00'))
      .lt('starts_at', toStartsAt(addDays(from, days), '00:00'))
      .order('starts_at'),
    supabase.from('settings').select('business_hours, slot_minutes').single()
  ]);
  const appts = (data ?? []) as unknown as Appt[];
  const hours = normalizeHours(settings?.business_hours);
  const slot = settings?.slot_minutes ?? 30;

  const step = week ? 7 : 1;
  const link = (d: string) => `/agenda?fecha=${d}${week ? '&vista=semana' : ''}`;
  const title = week ? `Semana del ${formatShortDay(from)} al ${formatShortDay(addDays(from, 6))}` : formatDay(date);

  // Vista de día: filas cada "slot" minutos, abarcando el horario y cualquier cita fuera de él.
  const rows: { time: string; items: Appt[] }[] = [];
  if (!week) {
    const h = hours[String(weekday(date))];
    let start = h.open ? toMinutes(h.from) : 8 * 60;
    let end = h.open ? toMinutes(h.to) : 18 * 60;
    for (const a of appts) {
      start = Math.min(start, Math.floor(toMinutes(timeOf(a.starts_at)) / slot) * slot);
      end = Math.max(end, toMinutes(timeOf(addMinutesIso(a.starts_at, a.duration_minutes))));
    }
    for (let t = start; t < end; t += slot) rows.push({ time: fromMinutes(t), items: [] });
    for (const a of appts) {
      const idx = Math.floor((toMinutes(timeOf(a.starts_at)) - start) / slot);
      rows[Math.max(0, Math.min(rows.length - 1, idx))]?.items.push(a);
    }
  }
  const closed = !week && !hours[String(weekday(date))].open;

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Aquí ves y programas las citas del día o de la semana. Pulsa “+” junto a una hora para agendar en ese momento, o toca una cita para cambiarla, cancelarla o recordársela al cliente por WhatsApp."
      />

      <div className="toolbar">
        <div className="agenda-nav">
          <Link className="btn btn-ghost" href={link(addDays(date, -step))}>←</Link>
          <Link className="btn btn-ghost" href={link(todayStr())}>Hoy</Link>
          <Link className="btn btn-ghost" href={link(addDays(date, step))}>→</Link>
          <Link className={week ? 'btn btn-ghost' : 'btn btn-primary'} href={`/agenda?fecha=${date}`}>Día</Link>
          <Link className={week ? 'btn btn-primary' : 'btn btn-ghost'} href={`/agenda?fecha=${date}&vista=semana`}>Semana</Link>
        </div>
        <Link className="btn btn-primary" href={`/agenda/nueva?fecha=${date}`}>Nueva cita</Link>
      </div>
      <h2 className="agenda-title">{title}</h2>

      {closed && <p className="muted">Este día no es de atención según tu horario.</p>}

      {appts.length === 0 && (
        <EmptyState title={week ? 'No hay citas esta semana.' : 'No hay citas este día.'}>
          Aquí aparecerán las citas que agendes. Pulsa “Nueva cita” para programar la primera.
        </EmptyState>
      )}

      {!week && !closed && (
        <div className="day-grid">
          {rows.map(r => (
            <div className="day-row" key={r.time}>
              <span className="day-time">{r.time}</span>
              <div className="day-items">
                {r.items.map(a => <ApptCard key={a.id} a={a} />)}
                <Link className="day-add" href={`/agenda/nueva?fecha=${date}&hora=${r.time}`} aria-label={`Agendar a las ${r.time}`}>+</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!week && closed && appts.map(a => <ApptCard key={a.id} a={a} />)}

      {week && (
        <div className="week-grid">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(d => (
            <div className={`week-col${d === todayStr() ? ' today' : ''}`} key={d}>
              <Link href={`/agenda?fecha=${d}`} className="week-head">{formatShortDay(d)}</Link>
              {!hours[String(weekday(d))].open && <span className="muted">Sin atención</span>}
              {appts.filter(a => dateOf(a.starts_at) === d).map(a => <ApptCard key={a.id} a={a} />)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
