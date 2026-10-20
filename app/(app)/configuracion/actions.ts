'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { parseWhole, type FormState } from '@/lib/form';
import { normalizePhone } from '@/lib/phone';

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

  const { error } = await supabase.from('settings').update({
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
    const { error } = await supabase.from(table).update({ name, active: fd.get('active') === 'on' }).eq('id', id);
    return error ? failed('No se pudo guardar.', error.code) : done('Guardado.');
  }
  const { data: last } = await supabase.from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const { error } = await supabase.from(table).insert({ name, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
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
