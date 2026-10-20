'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseWhole, type FormState, type WarnState } from '@/lib/form';
import { normalizePhone } from '@/lib/phone';
import { logActivity } from '@/lib/activity';

const BUCKET = 'pet-photos';
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const dateOrNull = (fd: FormData, key: string) => {
  const v = text(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const refresh = () => revalidatePath('/clientes', 'layout');

/* -------------------------------- Dueños -------------------------------- */

export async function saveOwner(_prev: WarnState, fd: FormData): Promise<WarnState> {
  const supabase = await createClient();
  const id = text(fd, 'id');
  const full_name = text(fd, 'full_name');
  if (!full_name) return { error: 'El nombre del cliente es obligatorio.' };

  const whatsapp = normalizePhone(text(fd, 'whatsapp'));
  if (whatsapp && whatsapp.length < 10) return { error: 'El WhatsApp parece incompleto. Escribe el celular con 10 dígitos.' };

  const referred_by = text(fd, 'referred_by') || null;
  if (referred_by && referred_by === id) return { error: 'Un cliente no puede referirse a sí mismo.' };

  const row = {
    full_name, whatsapp,
    address: text(fd, 'address'),
    birthday: dateOrNull(fd, 'birthday'),
    consent_messages: fd.get('consent_messages') === 'on',
    referred_by,
    notes: text(fd, 'notes')
  };

  // Aviso (no bloquea) si el WhatsApp o el nombre ya existen en otro cliente.
  let before: { whatsapp: string; full_name: string } | null = null;
  if (id) {
    const { data } = await supabase.from('owners').select('whatsapp, full_name').eq('id', id).maybeSingle();
    before = data;
  }
  if (fd.get('confirm') !== '1') {
    const warnings: string[] = [];
    if (whatsapp && before?.whatsapp !== whatsapp) {
      let q = supabase.from('owners').select('full_name').eq('whatsapp', whatsapp).limit(3);
      if (id) q = q.neq('id', id);
      const { data: same } = await q;
      if (same?.length) warnings.push(`Ya existe un cliente con este WhatsApp: ${same.map(o => o.full_name).join(', ')}.`);
    }
    if (!before || before.full_name.toLowerCase() !== full_name.toLowerCase()) {
      let q = supabase.from('owners').select('id').ilike('full_name', full_name.replace(/[%_\\]/g, m => '\\' + m)).limit(1);
      if (id) q = q.neq('id', id);
      const { data: sameName } = await q;
      if (sameName?.length) warnings.push(`Ya existe un cliente llamado “${full_name}”.`);
    }
    if (warnings.length) return { warnings };
  }

  if (id) {
    const { error } = await supabase.from('owners').update({ ...row, active: fd.get('active') === 'on' }).eq('id', id);
    if (error) return { error: 'No se pudo guardar.' };
    await logActivity(supabase, { action: 'cliente.editado', entity: 'owner', entityId: id, summary: `Editó al cliente ${full_name}`, details: { ...row, active: fd.get('active') === 'on' } });
    refresh();
    return { ok: 'Cliente guardado.' };
  }
  const { data, error } = await supabase.from('owners').insert(row).select('id').single();
  if (error) return { error: 'No se pudo crear el cliente.' };
  await logActivity(supabase, { action: 'cliente.creado', entity: 'owner', entityId: data.id, summary: `Creó al cliente ${full_name}`, details: row });
  refresh();
  redirect(`/clientes/${data.id}`);
}

/* ------------------------------- Mascotas ------------------------------- */

async function uploadPhoto(supabase: Awaited<ReturnType<typeof createClient>>, petId: string, file: File, oldPath: string | null) {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${petId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) return { path: null, error: 'No se pudo subir la foto.' };
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
  return { path, error: null };
}

export async function savePet(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const id = text(fd, 'id');
  const name = text(fd, 'name');
  const owner_id = text(fd, 'owner_id');
  if (!name) return { error: 'El nombre de la mascota es obligatorio.' };
  if (!owner_id) return { error: 'Falta el dueño de la mascota.' };

  const frequency_days = parseWhole(fd.get('frequency_days') || '30');
  if (!frequency_days) return { error: 'La frecuencia de baño debe ser un número de días mayor que 0.' };

  const photo = fd.get('photo');
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) return { error: 'La foto debe ser JPG, PNG o WebP.' };
    if (photo.size > MAX_PHOTO_BYTES) return { error: 'La foto pesa más de 4 MB. Usa una más liviana.' };
  }

  const row = {
    owner_id, name,
    breed: text(fd, 'breed'),
    size_id: text(fd, 'size_id') || null,
    birthdate: dateOrNull(fd, 'birthdate'),
    temperament: text(fd, 'temperament'),
    allergies: text(fd, 'allergies'),
    preferred_cut: text(fd, 'preferred_cut'),
    frequency_days,
    notes: text(fd, 'notes')
  };

  if (id) {
    const patch: Record<string, unknown> = { ...row, active: fd.get('active') === 'on' };
    if (hasPhoto) {
      const { data: current } = await supabase.from('pets').select('photo_path').eq('id', id).single();
      const up = await uploadPhoto(supabase, id, photo, current?.photo_path ?? null);
      if (up.error) return { error: up.error };
      patch.photo_path = up.path;
    }
    const { error } = await supabase.from('pets').update(patch).eq('id', id);
    if (error) return { error: 'No se pudo guardar.' };
    await logActivity(supabase, { action: 'mascota.editada', entity: 'pet', entityId: id, summary: `Editó a la mascota ${name}`, details: { ...row, photo_changed: hasPhoto } });
    refresh();
    return { ok: 'Mascota guardada.' };
  }

  const { data, error } = await supabase.from('pets').insert(row).select('id').single();
  if (error) return { error: 'No se pudo crear la mascota.' };
  if (hasPhoto) {
    const up = await uploadPhoto(supabase, data.id, photo, null);
    if (up.path) await supabase.from('pets').update({ photo_path: up.path }).eq('id', data.id);
  }
  await logActivity(supabase, { action: 'mascota.creada', entity: 'pet', entityId: data.id, summary: `Creó a la mascota ${name}`, details: row });
  refresh();
  redirect(`/mascotas/${data.id}`);
}
