'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { parseWhole, type FormState } from '@/lib/form';
import { isValidDate } from '@/lib/time';
import { dayTotals } from '@/lib/caja';

const BUCKET = 'pet-photos';
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const refresh = () => {
  revalidatePath('/caja', 'layout');
  revalidatePath('/agenda', 'layout');
  revalidatePath('/');
};

/** Los mensajes que escribimos en la base (código P0001) están en español y son seguros de mostrar. */
const friendly = (error: { code?: string; message: string }, fallback: string) =>
  error.code === 'P0001' ? error.message : error.code === '23505' ? 'Esta cita ya fue cobrada.' : fallback;

type Payload = {
  pet_id: string; appointment_id: string | null; groomer_id: string | null; visit_date: string;
  discount_pct: number; notes: string;
  items: { service_id: string; name: string; price: number }[];
  payments: { method_id: string; amount: number }[];
};

export async function registerVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  let p: Payload;
  try { p = JSON.parse(text(fd, 'payload')); } catch { return { error: 'No se pudo leer el cobro. Recarga la página.' }; }

  if (!p.pet_id) return { error: 'Falta la mascota.' };
  if (!isValidDate(p.visit_date)) return { error: 'La fecha del servicio no es válida.' };
  if (!Array.isArray(p.items) || p.items.length === 0) return { error: 'Agrega al menos un servicio.' };
  if (p.items.some(i => !i.name || !Number.isInteger(i.price) || i.price < 0)) return { error: 'Revisa los precios: deben ser números enteros.' };
  if (!(p.discount_pct >= 0 && p.discount_pct <= 100)) return { error: 'El descuento debe estar entre 0 y 100 %.' };
  if (!Array.isArray(p.payments) || p.payments.some(x => !x.method_id || !Number.isInteger(x.amount) || x.amount < 0)) {
    return { error: 'Revisa los pagos: deben ser números enteros.' };
  }

  const id = crypto.randomUUID();
  let photoPath: string | null = null;
  const photo = fd.get('photo');
  if (photo instanceof File && photo.size > 0) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) return { error: 'La foto debe ser JPG, PNG o WebP.' };
    if (photo.size > MAX_PHOTO_BYTES) return { error: 'La foto pesa más de 4 MB. Usa una más liviana.' };
    const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
    photoPath = `visits/${id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(photoPath, photo, { contentType: photo.type });
    if (error) return { error: 'No se pudo subir la foto.' };
  }

  const { error } = await supabase.rpc('register_visit', {
    p_id: id, p_pet_id: p.pet_id, p_appointment_id: p.appointment_id || null, p_groomer_id: p.groomer_id || null,
    p_visit_date: p.visit_date, p_discount_pct: p.discount_pct, p_notes: p.notes ?? '', p_photo_path: photoPath,
    p_items: p.items, p_payments: p.payments
  });
  if (error) {
    if (photoPath) await supabase.storage.from(BUCKET).remove([photoPath]);
    return { error: friendly(error, 'No se pudo registrar el cobro.') };
  }

  refresh();
  redirect(`/caja/${id}`);
}

export async function voidVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc('void_visit', { p_id: text(fd, 'id'), p_reason: text(fd, 'reason') });
  if (error) return { error: friendly(error, 'No se pudo anular el cobro.') };
  refresh();
  return { ok: 'Cobro anulado.' };
}

/* ------------------------------ Cierre del día ------------------------------ */

export async function closeDay(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const date = text(fd, 'date');
  if (!isValidDate(date)) return { error: 'Fecha no válida.' };

  const countedRaw = text(fd, 'counted_cash');
  const counted = countedRaw === '' ? null : parseWhole(countedRaw);
  if (countedRaw !== '' && counted === null) return { error: 'El efectivo contado debe ser un número.' };

  const t = await dayTotals(supabase, date);
  const { error } = await supabase.from('cash_closings').insert({
    closing_date: date, visits_count: t.count, total_income: t.total, by_method: t.byMethod,
    expected_cash: t.expectedCash, counted_cash: counted, difference: counted === null ? null : counted - t.expectedCash,
    notes: text(fd, 'notes')
  });
  if (error) return { error: error.code === '23505' ? 'Este día ya está cerrado.' : 'No se pudo cerrar el día.' };
  refresh();
  return { ok: 'Día cerrado.' };
}

export async function reopenDay(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('cash_closings').delete().eq('closing_date', text(fd, 'date'));
  if (error) return { error: 'No se pudo reabrir el día.' };
  refresh();
  return { ok: 'Cierre reabierto.' };
}
