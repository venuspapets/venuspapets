'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseWhole } from '@/lib/form';
import { normalizeHours } from '@/lib/hours';
import { STATUSES, statusLabel } from '@/lib/appointments';
import { logActivity } from '@/lib/activity';
import { DAY_NAMES, addDays, dateOf, isValidDate, timeOf, toMinutes, toStartsAt, weekday } from '@/lib/time';

export type AppointmentState = { error?: string; ok?: string; warnings?: string[] } | null;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

export async function saveAppointment(_prev: AppointmentState, fd: FormData): Promise<AppointmentState> {
  const supabase = await createClient();
  const id = text(fd, 'id');
  const pet_id = text(fd, 'pet_id');
  const date = text(fd, 'date');
  const time = text(fd, 'time');
  const groomer_id = text(fd, 'groomer_id') || null;
  const duration = parseWhole(fd.get('duration'));
  const serviceIds = fd.getAll('service_id').map(String).filter(Boolean);
  const status = STATUSES.some(s => s.key === text(fd, 'status')) ? text(fd, 'status') : 'agendada';

  if (!pet_id) return { error: 'Elige la mascota.' };
  if (!isValidDate(date)) return { error: 'Elige una fecha válida.' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: 'Elige la hora de la cita.' };
  if (!duration) return { error: 'La duración debe ser un número de minutos mayor que 0.' };

  const startIso = toStartsAt(date, time);
  const startMs = new Date(startIso).getTime();
  const endMs = startMs + duration * 60000;

  // Avisos (no bloquean): se pide confirmación y, si se confirma, se agenda igual.
  if (fd.get('confirm') !== '1') {
    const warnings: string[] = [];
    const { data: settings } = await supabase.from('settings').select('business_hours, slot_minutes').single();
    const hours = normalizeHours(settings?.business_hours)[String(weekday(date))];
    const endTime = timeOf(new Date(endMs).toISOString());
    if (!hours.open) {
      warnings.push(`El ${DAY_NAMES[weekday(date)].toLowerCase()} no es un día de atención.`);
    } else if (toMinutes(time) < toMinutes(hours.from) || toMinutes(endTime) > toMinutes(hours.to) || endTime < time) {
      warnings.push(`La cita (${time} a ${endTime}) queda fuera del horario de atención (${hours.from} a ${hours.to}).`);
    }

    if (groomer_id) {
      const buffer = (settings?.slot_minutes ?? 30) * 60000;
      let query = supabase.from('appointments')
        .select('starts_at, duration_minutes, pets(name)')
        .eq('groomer_id', groomer_id)
        .eq('status', 'agendada')
        .gte('starts_at', toStartsAt(addDays(date, -1), '00:00'))
        .lt('starts_at', toStartsAt(addDays(date, 2), '00:00'));
      if (id) query = query.neq('id', id);
      const { data: others } = await query;

      for (const o of others ?? []) {
        const oStart = new Date(o.starts_at).getTime();
        const oEnd = oStart + o.duration_minutes * 60000;
        if (oStart < endMs + buffer && oEnd + buffer > startMs) {
          const pet = (o.pets as unknown as { name: string } | null)?.name ?? 'Otra mascota';
          const span = `${timeOf(o.starts_at)} a ${timeOf(new Date(oEnd).toISOString())}`;
          warnings.push(oStart < endMs && oEnd > startMs
            ? `${pet} ya tiene cita de ${span} y se cruza con esta.`
            : `${pet} tiene cita de ${span}, a menos de ${settings?.slot_minutes ?? 30} minutos de esta.`);
        }
      }
    }
    if (warnings.length) return { warnings };
  }

  const row = { pet_id, groomer_id, starts_at: startIso, duration_minutes: duration, notes: text(fd, 'notes') };
  let appointmentId = id;
  if (id) {
    const { error } = await supabase.from('appointments').update({ ...row, status }).eq('id', id);
    if (error) return { error: 'No se pudo guardar la cita.' };
    await supabase.from('appointment_services').delete().eq('appointment_id', id);
  } else {
    const { data, error } = await supabase.from('appointments').insert(row).select('id').single();
    if (error) return { error: 'No se pudo crear la cita.' };
    appointmentId = data.id;
  }

  if (serviceIds.length) {
    const { error } = await supabase.from('appointment_services')
      .insert(serviceIds.map(service_id => ({ appointment_id: appointmentId, service_id })));
    if (error) return { error: 'La cita se guardó, pero no se pudieron guardar sus servicios.' };
  }

  const { data: pet } = await supabase.from('pets').select('name').eq('id', pet_id).maybeSingle();
  await logActivity(supabase, {
    action: id ? 'cita.editada' : 'cita.creada', entity: 'appointment', entityId: appointmentId,
    summary: `${id ? 'Editó' : 'Agendó'} la cita de ${pet?.name ?? 'una mascota'} el ${date} a las ${time}${id && status !== 'agendada' ? ` (estado: ${status})` : ''}`,
    details: { date, time, duration, status, services: serviceIds.length, groomer_id }
  });

  revalidatePath('/agenda', 'layout');
  revalidatePath('/');
  if (!id) redirect(`/agenda?fecha=${date}`);
  return { ok: 'Cita guardada.' };
}

/** Elimina una cita que sigue programada. Las demás son historial y no se tocan. */
export async function deleteAppointment(_prev: AppointmentState, fd: FormData): Promise<AppointmentState> {
  const supabase = await createClient();
  const id = text(fd, 'id');

  const { data: appt } = await supabase.from('appointments')
    .select('id, status, starts_at, duration_minutes, pet_id, pets(name)').eq('id', id).maybeSingle();
  if (!appt) return { error: 'La cita no existe o ya fue eliminada.' };
  if (appt.status !== 'agendada') {
    return { error: 'Solo se pueden eliminar citas programadas. Esta ya está marcada como ' + statusLabel(appt.status).toLowerCase() + '.' };
  }

  const { error } = await supabase.from('appointments').delete().eq('id', id);
  if (error) return { error: error.code === 'P0001' ? error.message : 'No se pudo eliminar la cita.' };

  const date = dateOf(appt.starts_at);
  const petName = (appt.pets as unknown as { name: string } | null)?.name ?? 'una mascota';
  await logActivity(supabase, {
    action: 'cita.eliminada', entity: 'appointment', entityId: id,
    summary: `Eliminó la cita de ${petName} del ${date} a las ${timeOf(appt.starts_at)}`,
    details: { date, time: timeOf(appt.starts_at), duration: appt.duration_minutes, pet_id: appt.pet_id }
  });

  revalidatePath('/agenda', 'layout');
  revalidatePath('/');
  redirect(`/agenda?fecha=${date}`);
}
