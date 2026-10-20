'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { parseWhole, type FormState } from '@/lib/form';
import { normalizePhone } from '@/lib/phone';
import { toMinutes } from '@/lib/time';

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const done = (ok: string): FormState => {
  revalidatePath('/configuracion', 'layout');
  return { ok };
};
const failed = (message: string, code?: string): FormState => ({
  error: code === '23505' ? 'Ya existe un registro con ese nombre.' : message
});

/* ------------------------------- Negocio ------------------------------- */

export async function saveBusiness(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const business_name = text(fd, 'business_name');
  if (!business_name) return { error: 'El nombre del negocio es obligatorio.' };

  const hours: Record<string, { open: boolean; from: string; to: string }> = {};
  for (let d = 0; d < 7; d++) {
    const from = text(fd, 'from_' + d);
    const to = text(fd, 'to_' + d);
    const open = fd.get('open_' + d) === 'on';
    if (!/^d{2}:d{2}$/.test(from) || !/^d{2}:d{2}$/.test(to)) return { error: 'Revisa las horas del horario de atención.' };
    if (open && toMinutes(from) >= toMinutes(to)) return { error: 'En cada día de atención la hora de cierre debe ser mayor que la de apertura.' };
    hours[String(d)] = { open, from, to };
  }
  const slot_minutes = parseWhole(fd.get('slot_minutes'));
  if (!slot_minutes || slot_minutes < 5 || slot_minutes > 120) return { error: 'El espacio entre citas debe estar entre 5 y 120 minutos.' };

  const { error } = await supabase.from('settings').update({
    business_hours: hours,
    slot_minutes,
    business_name,
    owner_name: text(fd, 'owner_name'),
    owner_phone: normalizePhone(text(fd, 'owner_phone')),
    address: text(fd, 'address')
  }).eq('id', true);
  return error ? failed('No se pudo guardar.', error.code) : done('Datos guardados.');
}

/* ------------------------------- Tamaños ------------------------------- */

export async function saveSize(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const id = text(fd, 'id');
  const name = text(fd, 'name');
  const base_minutes = parseWhole(fd.get('base_minutes'));
  if (!name) return { error: 'El nombre es obligatorio.' };
  if (!base_minutes) return { error: 'Los minutos deben ser un número mayor que 0.' };

  const row = { name, hint: text(fd, 'hint'), base_minutes, active: id ? fd.get('active') === 'on' : true };
  if (id) {
    const { error } = await supabase.from('sizes').update(row).eq('id', id);
    return error ? failed('No se pudo guardar.', error.code) : done('Guardado.');
  }
  const { data: last } = await supabase.from('sizes').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const { error } = await supabase.from('sizes').insert({ ...row, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  return error ? failed('No se pudo crear.', error.code) : done('Tamaño creado.');
}

/* ------------------- Medios de pago y categorías de gastos ------------------- */

const CATALOGS = ['payment_methods', 'expense_categories'] as const;

export async function saveCatalogItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const table = text(fd, 'table');
  if (!(CATALOGS as readonly string[]).includes(table)) return { error: 'Catálogo no válido.' };

  const id = text(fd, 'id');
  const name = text(fd, 'name');
  if (!name) return { error: 'El nombre es obligatorio.' };

  if (id) {
    const patch: Record<string, unknown> = { name, active: fd.get('active') === 'on' };
    if (table === 'payment_methods') patch.is_cash = fd.get('is_cash') === 'on';
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    return error ? failed('No se pudo guardar.', error.code) : done('Guardado.');
  }
  const { data: last } = await supabase.from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const extra = table === 'payment_methods' ? { is_cash: fd.get('is_cash') === 'on' } : {};
  const { error } = await supabase.from(table).insert({ name, sort_order: (last?.[0]?.sort_order ?? 0) + 1, ...extra });
  return error ? failed('No se pudo crear.', error.code) : done('Agregado.');
}

/* ------------------------------- Servicios ------------------------------- */

export async function saveService(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const id = text(fd, 'id');
  const name = text(fd, 'name');
  const extra_minutes = parseWhole(fd.get('extra_minutes') || '0');
  if (!name) return { error: 'El nombre del servicio es obligatorio.' };
  if (extra_minutes === null) return { error: 'Los minutos extra deben ser un número.' };

  // Precios por tamaño: campos price_<id del tamaño>. Vacío = no se ofrece en ese tamaño.
  const prices: { size_id: string; price: number }[] = [];
  const removed: string[] = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('price_')) continue;
    const size_id = key.slice('price_'.length);
    if (String(value).trim() === '') { removed.push(size_id); continue; }
    const price = parseWhole(value);
    if (price === null) return { error: 'Los precios deben ser números, sin letras ni signos.' };
    prices.push({ size_id, price });
  }

  const row = { name, kind: text(fd, 'kind') === 'adicional' ? 'adicional' : 'base', extra_minutes, active: id ? fd.get('active') === 'on' : true };
  let serviceId = id;
  if (id) {
    const { error } = await supabase.from('services').update(row).eq('id', id);
    if (error) return failed('No se pudo guardar.', error.code);
  } else {
    const { data, error } = await supabase.from('services').insert(row).select('id').single();
    if (error) return failed('No se pudo crear.', error.code);
    serviceId = data.id;
  }

  if (prices.length) {
    const { error } = await supabase.from('service_prices')
      .upsert(prices.map(p => ({ ...p, service_id: serviceId })), { onConflict: 'service_id,size_id' });
    if (error) return failed('El servicio se guardó, pero fallaron los precios.');
  }
  if (removed.length) {
    await supabase.from('service_prices').delete().eq('service_id', serviceId).in('size_id', removed);
  }
  return done(id ? 'Servicio guardado.' : 'Servicio creado.');
}

export async function addBreedPrice(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const breed = text(fd, 'breed');
  const price = parseWhole(fd.get('price'));
  if (!breed) return { error: 'Escribe la raza.' };
  if (price === null) return { error: 'El precio debe ser un número.' };

  const { error } = await supabase.from('service_breed_prices').insert({ service_id: text(fd, 'service_id'), breed, price });
  return error ? failed('No se pudo agregar.', error.code) : done('Precio por raza agregado.');
}

export async function removeBreedPrice(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('service_breed_prices').delete().eq('id', text(fd, 'id'));
  return error ? failed('No se pudo quitar.') : done('Quitado.');
}

/* ------------------------------- Descuentos ------------------------------- */

const pctValue = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
};

export async function saveDiscountRules(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const loyalty_every = parseWhole(fd.get('loyalty_every'));
  const loyalty_pct = pctValue(fd.get('loyalty_pct'));
  const birthday_pct = pctValue(fd.get('birthday_pct'));
  const window = parseWhole(fd.get('birthday_window_days'));
  if (!loyalty_every) return { error: 'Los baños para el descuento deben ser un número mayor que 0.' };
  if (loyalty_pct === null || birthday_pct === null) return { error: 'Los porcentajes deben estar entre 0 y 100.' };
  if (window === null || window > 30) return { error: 'Los días de cumpleaños deben estar entre 0 y 30.' };

  const { error } = await supabase.from('settings').update({
    loyalty_enabled: fd.get('loyalty_enabled') === 'on', loyalty_every, loyalty_pct,
    birthday_enabled: fd.get('birthday_enabled') === 'on', birthday_pct, birthday_window_days: window
  }).eq('id', true);
  return error ? failed('No se pudo guardar.') : done('Reglas guardadas.');
}

export async function savePromotion(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const id = text(fd, 'id');
  const name = text(fd, 'name');
  const pct = pctValue(fd.get('pct'));
  const starts_on = text(fd, 'starts_on');
  const ends_on = text(fd, 'ends_on');
  if (!name) return { error: 'Ponle un nombre a la promoción.' };
  if (pct === null) return { error: 'El porcentaje debe estar entre 0 y 100.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(starts_on) || !/^\d{4}-\d{2}-\d{2}$/.test(ends_on)) return { error: 'Elige la fecha de inicio y la de fin.' };
  if (ends_on < starts_on) return { error: 'La fecha de fin no puede ser anterior a la de inicio.' };

  const row = { name, pct, starts_on, ends_on, active: id ? fd.get('active') === 'on' : true };
  const { error } = id ? await supabase.from('promotions').update(row).eq('id', id) : await supabase.from('promotions').insert(row);
  return error ? failed('No se pudo guardar la promoción.') : done(id ? 'Promoción guardada.' : 'Promoción creada.');
}

export async function removePromotion(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('promotions').delete().eq('id', text(fd, 'id'));
  return error ? failed('No se pudo quitar.') : done('Promoción quitada.');
}
