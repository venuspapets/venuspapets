'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { groomerName } from '@/lib/appointments';
import { logActivity } from '@/lib/activity';
import type { FormState } from '@/lib/form';
import { TYPE_LABELS, computeReminders } from '@/lib/reminders';
import { todayStr } from '@/lib/time';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

/**
 * Anota que un recordatorio se envió. El servidor vuelve a calcular el recordatorio a partir de su
 * clave: no se confía en el mensaje ni en el teléfono que mande el navegador.
 */
export async function sendReminder(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const key = text(fd, 'key');
  const { pending } = await computeReminders(supabase, todayStr());
  const r = pending.find(x => x.key === key);
  if (!r) return { error: 'Este recordatorio ya no está pendiente. Actualiza la página.' };

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('full_name, role').eq('id', user.id).single() : { data: null };

  const { error } = await supabase.from('reminder_log').insert({
    base_key: r.baseKey, type: r.type, pet_id: r.petId, owner_id: r.ownerId,
    appointment_id: r.type === 'cita' ? r.baseKey.slice('cita:'.length) : null,
    whatsapp: r.whatsapp, message: r.message, sent_by_name: profile ? groomerName(profile) : ''
  });
  if (error) return { error: 'No se pudo anotar el envío.' };

  await logActivity(supabase, {
    action: 'recordatorio.enviado', entity: 'reminder', entityId: r.baseKey,
    summary: `Envió el recordatorio “${TYPE_LABELS[r.type]}” de ${r.petName} a ${r.ownerName}`
  });
  revalidatePath('/recordatorios');
  return { ok: 'Marcado como enviado.' };
}

/** Deshace un envío marcado por error (solo las últimas 24 horas). */
export async function undoReminder(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('undo_reminder', { p_id: text(fd, 'id') });
  if (error) return { error: error.code === 'P0001' ? error.message : 'No se pudo deshacer.' };
  revalidatePath('/recordatorios');
  return { ok: 'Envío deshecho.' };
}

/** ¿Hay recordatorios pendientes que este usuario todavía no ha visto? (para que titile la campana) */
export async function getReminderStatus(): Promise<{ unseen: boolean; count: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { unseen: false, count: 0 };
  const [{ pending }, { data: profile }] = await Promise.all([
    computeReminders(supabase, todayStr()),
    supabase.from('profiles').select('reminders_seen_keys').eq('id', user.id).single()
  ]);
  const seen = new Set<string>(profile?.reminders_seen_keys ?? []);
  return { unseen: pending.some(r => !seen.has(r.key)), count: pending.length };
}

/** Al entrar a la pantalla de recordatorios, todos los pendientes quedan como vistos. */
export async function markRemindersSeen(): Promise<void> {
  const supabase = await createClient();
  const { pending } = await computeReminders(supabase, todayStr());
  await supabase.rpc('mark_reminders_seen', { p_keys: pending.map(r => r.key) });
}
