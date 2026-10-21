'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { parseWhole, type FormState } from '@/lib/form';
import { isValidDate } from '@/lib/time';
import { dayTotals } from '@/lib/caja';
import { eligibleDiscounts } from '@/lib/discounts';
import { priceFor } from '@/lib/pricing';
import { logActivity } from '@/lib/activity';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const refresh = () => {
  revalidatePath('/caja', 'layout');
  revalidatePath('/agenda', 'layout');
  revalidatePath('/');
};

/** Los mensajes que escribimos en la base (código P0001) están en español y son seguros de mostrar. */
const friendly = (error: { code?: string; message: string }, fallback: string) =>
  error.code === 'P0001' ? error.message.replace(/(\d+)\.00\b/, '$1') : error.code === '23505' ? 'Esta cita ya fue cobrada.' : fallback;

type Payload = {
  pet_id: string; appointment_id: string | null; groomer_id: string | null; visit_date: string;
  discount_pct: number; discount_type: string | null; discount_label: string | null; discount_reason: string; notes: string;
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

  // El servidor recalcula qué descuentos corresponden: nunca se confía en lo que envía el navegador.
  const { data: pet } = await supabase.from('pets').select('id, name, birthdate, breed, size_id').eq('id', p.pet_id).maybeSingle();
  if (!pet) return { error: 'No se encontró la mascota.' };
  const eligible = await eligibleDiscounts(supabase, pet, p.visit_date);
  const reason = String(p.discount_reason ?? '').trim();
  let discountType: string | null = null;
  let discountLabel: string | null = null;
  if (p.discount_pct > 0) {
    const match = eligible.options.find(o => o.type === p.discount_type && o.label === p.discount_label && o.pct === p.discount_pct);
    if (match) {
      discountType = match.type;
      discountLabel = match.label;
    } else {
      if (!reason) return { error: 'Escribe el motivo del descuento: es distinto al sugerido.' };
      discountType = 'manual';
      discountLabel = 'Manual';
    }
  }

  const id = crypto.randomUUID();
  const { error } = await supabase.rpc('register_visit', {
    p_id: id, p_pet_id: p.pet_id, p_appointment_id: p.appointment_id || null, p_groomer_id: p.groomer_id || null,
    p_visit_date: p.visit_date, p_discount_pct: p.discount_pct,
    p_discount_type: discountType, p_discount_label: discountLabel, p_discount_reason: discountType === 'manual' ? reason : null,
    p_suggested_pct: eligible.best?.pct ?? null, p_suggested_label: eligible.best?.label ?? null,
    p_notes: p.notes ?? '',
    p_items: p.items, p_payments: p.payments
  });
  if (error) return { error: friendly(error, 'No se pudo registrar el cobro.') };

  // Registro de actividad: deja constancia de precios cambiados a mano y del descuento aplicado.
  const { data: svc } = await supabase.from('services')
    .select('id, service_prices(size_id, price), service_breed_prices(breed, price)')
    .in('id', p.items.map(i => i.service_id).filter(Boolean));
  const priceChanges = p.items.flatMap(i => {
    const s = svc?.find(x => x.id === i.service_id);
    const catalog = s ? priceFor(s, pet) : null;
    return catalog !== null && catalog !== i.price ? [{ name: i.name, catalog, charged: i.price }] : [];
  });
  const subtotal = p.items.reduce((sum, i) => sum + i.price, 0);
  const discountAmount = Math.round(subtotal * p.discount_pct / 100);
  const flags = [priceChanges.length ? 'precio modificado' : '', discountType === 'manual' ? 'descuento manual' : ''].filter(Boolean);
  await logActivity(supabase, {
    action: 'cobro.registrado', entity: 'visit', entityId: id,
    summary: `Cobró a ${pet.name}: $${(subtotal - discountAmount).toLocaleString('es-CO')}${flags.length ? ` (${flags.join(', ')})` : ''}`,
    details: {
      total: subtotal - discountAmount, subtotal, discount_pct: p.discount_pct, discount_amount: discountAmount,
      discount_type: discountType, discount_label: discountLabel, discount_reason: discountType === 'manual' ? reason : null,
      price_changes: priceChanges
    }
  });

  refresh();
  redirect(`/caja/${id}`);
}

export async function voidVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc('void_visit', { p_id: text(fd, 'id'), p_reason: text(fd, 'reason') });
  if (error) return { error: friendly(error, 'No se pudo anular el cobro.') };
  const { data: v } = await supabase.from('visits').select('total, pets(name)').eq('id', text(fd, 'id')).maybeSingle();
  const petName = (v?.pets as unknown as { name: string } | null)?.name ?? 'una mascota';
  await logActivity(supabase, {
    action: 'cobro.anulado', entity: 'visit', entityId: text(fd, 'id'),
    summary: `Anuló el cobro de ${petName}${v ? ` ($${v.total.toLocaleString('es-CO')})` : ''}`,
    details: { reason: text(fd, 'reason') }
  });
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
    cash_expenses: t.cashExpenses, expected_cash: t.expectedCash, counted_cash: counted, difference: counted === null ? null : counted - t.expectedCash,
    notes: text(fd, 'notes')
  });
  if (error) return { error: error.code === '23505' ? 'Este día ya está cerrado.' : 'No se pudo cerrar el día.' };
  await logActivity(supabase, {
    action: 'caja.cierre', entity: 'cash_closing', entityId: date,
    summary: `Cerró el día ${date}: ${t.count} servicio(s), $${t.total.toLocaleString('es-CO')}`,
    details: { total: t.total, expected_cash: t.expectedCash, counted_cash: counted, difference: counted === null ? null : counted - t.expectedCash, notes: text(fd, 'notes') }
  });
  refresh();
  return { ok: 'Día cerrado.' };
}

export async function reopenDay(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('cash_closings').delete().eq('closing_date', text(fd, 'date'));
  if (error) return { error: 'No se pudo reabrir el día.' };
  await logActivity(supabase, { action: 'caja.reapertura', entity: 'cash_closing', entityId: text(fd, 'date'), summary: `Reabrió el cierre del día ${text(fd, 'date')}` });
  refresh();
  return { ok: 'Cierre reabierto.' };
}
