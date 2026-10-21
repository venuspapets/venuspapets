import type { SupabaseClient } from '@supabase/supabase-js';
import { daysToBirthday } from '@/lib/discounts';
import { addDays, dateOf, formatDay, timeOf, toStartsAt } from '@/lib/time';

export type ReminderType = 'cita' | 'bano' | 'cumple' | 'reactiva';

export const TYPE_LABELS: Record<ReminderType, string> = {
  cita: 'Citas de mañana',
  bano: 'Les toca el baño',
  cumple: 'Cumpleaños de mascotas',
  reactiva: 'Clientes que no han vuelto'
};
export const TYPE_ORDER: ReminderType[] = ['cita', 'cumple', 'bano', 'reactiva'];

export type Reminder = {
  key: string;            // identifica este aviso (cambia si se repite)
  baseKey: string;        // identifica el motivo del aviso
  type: ReminderType;
  petId: string; petName: string;
  ownerId: string; ownerName: string; whatsapp: string;
  dueDate: string;        // para ordenar: del más antiguo al más nuevo
  info: string;
  message: string;
  timesSent: number;
  lastSent?: { at: string; type: ReminderType };   // último mensaje enviado a esta mascota, de cualquier tipo
};

export type SentEntry = { id: string; type: ReminderType; sentAt: string; sentBy: string; petName: string; ownerName: string };

type OwnerRef = { id: string; full_name: string; whatsapp: string; consent_messages: boolean; active: boolean } | null;

const DAY_MS = 86400000;
const PAGE = 1000; // Supabase devuelve como máximo 1000 filas por consulta.

/** Trae todas las filas de una consulta, de 1000 en 1000. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/* ------------------------------ Mensajes ------------------------------ */
// Un solo mensaje por recordatorio, armado con los datos de la mascota y del dueño.

export function citaMessage(owner: string, pet: string, business: string, date: string, time: string, services: string) {
  return `Hola ${firstName(owner)} 🐶, te recordamos la cita de ${pet} en ${business} mañana ${formatDay(date)} a las ${time}${services ? ` (${services})` : ''}. ¡Los esperamos! 💜 Por favor responde para confirmar.`;
}

export function banoMessage(owner: string, pet: string, business: string, daysSince: number) {
  return `Hola ${firstName(owner)} 🐾, ya toca el baño de ${pet} (el último fue hace ${daysSince} días). ¿Te agendo una cita en ${business}? 🛁💜`;
}

export function cumpleMessage(owner: string, pet: string, business: string, inDays: number, discountPct: number | null) {
  const when = inDays === 0 ? 'hoy' : inDays === 1 ? 'mañana' : `en ${inDays} días`;
  const gift = discountPct ? `En ${business} queremos celebrarlo con un ${discountPct}% de descuento en su baño.` : `En ${business} le mandamos un abrazo enorme.`;
  return `¡Hola ${firstName(owner)}! 🎂🐶 ${pet} está de cumpleaños ${when}. ${gift} ¡Escríbenos para agendar! 💜`;
}

export function reactivaMessage(owner: string, pet: string, business: string, daysSince: number) {
  return `Hola ${firstName(owner)} 🐶, ¡hace ${daysSince} días no vemos a ${pet} por ${business}! Lo extrañamos 💜 ¿Le agendamos un baño esta semana?`;
}

/** Resumen de la agenda del día para el dueño del negocio. */
export function ownerAgendaMessage(items: { time: string; pet: string; owner: string; services: string }[], date: string, business: string) {
  if (items.length === 0) return `Agenda de ${formatDay(date)}: sin citas agendadas.`;
  const lines = items.map(i => `• ${i.time} — ${i.pet} (${i.owner})${i.services ? ` — ${i.services}` : ''}`);
  return `📅 Agenda de ${formatDay(date)} — ${business}\n${lines.join('\n')}`;
}

/* ------------------------------ Cálculo ------------------------------ */

/**
 * Recordatorios pendientes de hoy, el historial de envíos y cuántos se omitieron por falta de
 * autorización del cliente. Solo se incluyen dueños activos que autorizaron mensajes y tienen WhatsApp.
 */
export async function computeReminders(supabase: SupabaseClient, today: string) {
  const now = Date.now();
  const tomorrow = addDays(today, 1);

  const { data: s } = await supabase.from('settings')
    .select('business_name, owner_phone, birthday_enabled, birthday_pct, birthday_window_days, reminder_repeat_days, reactivation_first, reactivation_second')
    .single();
  const business = s?.business_name ?? 'nuestra peluquería';
  const repeatMs = (s?.reminder_repeat_days ?? 7) * DAY_MS;
  const first = s?.reactivation_first ?? 30;
  const second = s?.reactivation_second ?? 60;
  const window = s?.birthday_window_days ?? 7;

  const [appts, pets, stats, future, log, historyRows] = await Promise.all([
    supabase.from('appointments')
      .select('id, starts_at, pets(id, name, owners(id, full_name, whatsapp, consent_messages, active)), appointment_services(services(name))')
      .eq('status', 'agendada')
      .gte('starts_at', toStartsAt(tomorrow, '00:00')).lt('starts_at', toStartsAt(addDays(tomorrow, 1), '00:00'))
      .then(r => r.data ?? []),
    fetchAll<{ id: string; name: string; birthdate: string | null; frequency_days: number; owners: OwnerRef }>((a, b) =>
      supabase.from('pets').select('id, name, birthdate, frequency_days, owners(id, full_name, whatsapp, consent_messages, active)')
        .eq('active', true).order('id').range(a, b) as never),
    fetchAll<{ pet_id: string; last_visit: string; baths: number }>((a, b) => supabase.rpc('pet_visit_stats').range(a, b) as never),
    fetchAll<{ pet_id: string }>((a, b) =>
      supabase.from('appointments').select('pet_id').eq('status', 'agendada').gte('starts_at', new Date(now).toISOString()).order('id').range(a, b) as never),
    fetchAll<{ base_key: string; type: ReminderType; pet_id: string | null; sent_at: string }>((a, b) =>
      supabase.from('reminder_log').select('base_key, type, pet_id, sent_at').is('undone_at', null)
        .gte('sent_at', new Date(now - 400 * DAY_MS).toISOString()).order('sent_at').range(a, b) as never),
    supabase.from('reminder_log')
      .select('id, type, sent_at, sent_by_name, pets(name), owners(full_name)')
      .is('undone_at', null).gte('sent_at', new Date(now - 30 * DAY_MS).toISOString())
      .order('sent_at', { ascending: true }).limit(500).then(r => r.data ?? [])
  ]);

  // Historial de envíos por motivo y por mascota.
  const byBase = new Map<string, { count: number; last: number }>();
  const lastByPet = new Map<string, { at: string; type: ReminderType }>();
  for (const l of log) {
    const cur = byBase.get(l.base_key) ?? { count: 0, last: 0 };
    byBase.set(l.base_key, { count: cur.count + 1, last: Math.max(cur.last, Date.parse(l.sent_at)) });
    if (l.pet_id) {
      const prev = lastByPet.get(l.pet_id);
      if (!prev || l.sent_at > prev.at) lastByPet.set(l.pet_id, { at: l.sent_at, type: l.type });
    }
  }

  const futurePets = new Set(future.map(f => f.pet_id));
  const statsByPet = new Map(stats.map(x => [x.pet_id, x]));
  const pending: Reminder[] = [];
  let excluded = 0;

  const allowed = (o: OwnerRef): o is NonNullable<OwnerRef> => {
    if (!o || !o.active) return false;
    if (!o.consent_messages || !o.whatsapp) { excluded++; return false; }
    return true;
  };
  const add = (r: Omit<Reminder, 'timesSent' | 'lastSent'> & { timesSent?: number }) =>
    pending.push({ ...r, timesSent: r.timesSent ?? 0, lastSent: lastByPet.get(r.petId) });

  // 1) Citas de mañana (un solo aviso por cita).
  for (const a of appts as unknown as { id: string; starts_at: string; pets: { id: string; name: string; owners: OwnerRef } | null; appointment_services: { services: { name: string } | null }[] }[]) {
    const pet = a.pets;
    if (!pet || byBase.has(`cita:${a.id}`) || !allowed(pet.owners)) continue;
    const services = a.appointment_services.map(x => x.services?.name).filter(Boolean).join(', ');
    const time = timeOf(a.starts_at);
    add({
      key: `cita:${a.id}`, baseKey: `cita:${a.id}`, type: 'cita', petId: pet.id, petName: pet.name,
      ownerId: pet.owners.id, ownerName: pet.owners.full_name, whatsapp: pet.owners.whatsapp,
      dueDate: dateOf(a.starts_at), info: `Mañana a las ${time}${services ? ` · ${services}` : ''}`,
      message: citaMessage(pet.owners.full_name, pet.name, business, dateOf(a.starts_at), time, services)
    });
  }

  for (const pet of pets) {
    // 2) Cumpleaños de la mascota (una vez al año).
    if (pet.birthdate) {
      const d = daysToBirthday(pet.birthdate, today);
      const base = `cumple:${pet.id}:${today.slice(0, 4)}`;
      if (d >= 0 && d <= window && !byBase.has(base) && allowed(pet.owners)) {
        add({
          key: base, baseKey: base, type: 'cumple', petId: pet.id, petName: pet.name,
          ownerId: pet.owners.id, ownerName: pet.owners.full_name, whatsapp: pet.owners.whatsapp,
          dueDate: addDays(today, d), info: d === 0 ? 'Cumple hoy' : d === 1 ? 'Cumple mañana' : `Cumple en ${d} días`,
          message: cumpleMessage(pet.owners.full_name, pet.name, business, d, s?.birthday_enabled ? Number(s.birthday_pct) : null)
        });
      }
    }

    // 3) Toca baño y 4) reactivación, según el último baño (sin cita futura).
    const st = statsByPet.get(pet.id);
    if (!st || futurePets.has(pet.id)) continue;
    const daysSince = daysBetween(st.last_visit, today);
    const overdue = daysSince - pet.frequency_days;
    if (overdue < 0) continue;

    if (overdue < first) {
      const base = `bano:${pet.id}:${st.last_visit}`;
      const sent = byBase.get(base);
      const again = !sent || now - sent.last >= repeatMs;
      if (again && allowed(pet.owners)) {
        add({
          key: `${base}:${sent?.count ?? 0}`, baseKey: base, type: 'bano', petId: pet.id, petName: pet.name,
          ownerId: pet.owners.id, ownerName: pet.owners.full_name, whatsapp: pet.owners.whatsapp,
          dueDate: addDays(st.last_visit, pet.frequency_days), info: `Último baño hace ${daysSince} días (le tocaba cada ${pet.frequency_days})`,
          message: banoMessage(pet.owners.full_name, pet.name, business, daysSince), timesSent: sent?.count ?? 0
        });
      }
    } else {
      const stage = overdue >= second ? second : first;
      const base = `reactiva:${pet.id}:${st.last_visit}:${stage}`;
      if (!byBase.has(base) && allowed(pet.owners)) {
        add({
          key: base, baseKey: base, type: 'reactiva', petId: pet.id, petName: pet.name,
          ownerId: pet.owners.id, ownerName: pet.owners.full_name, whatsapp: pet.owners.whatsapp,
          dueDate: addDays(st.last_visit, pet.frequency_days + stage), info: `No viene hace ${daysSince} días (${overdue} de retraso)`,
          message: reactivaMessage(pet.owners.full_name, pet.name, business, daysSince)
        });
      }
    }
  }

  // Del más antiguo al más nuevo.
  pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.petName.localeCompare(b.petName));

  const history: SentEntry[] = (historyRows as unknown as { id: string; type: ReminderType; sent_at: string; sent_by_name: string; pets: { name: string } | null; owners: { full_name: string } | null }[])
    .map(h => ({ id: h.id, type: h.type, sentAt: h.sent_at, sentBy: h.sent_by_name, petName: h.pets?.name ?? '—', ownerName: h.owners?.full_name ?? '—' }));

  return { pending, history, excluded, business, ownerPhone: s?.owner_phone ?? '' };
}
