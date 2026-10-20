import { createClient } from '@/lib/supabase/server';
import { groomerName } from '@/lib/appointments';
import type { GroomerOption, PetOption, ServiceOption } from './AppointmentForm';

/** Datos que necesita el formulario de citas: mascotas, servicios y quién atiende. */
export async function loadFormOptions() {
  const supabase = await createClient();
  const [{ data: pets }, { data: services }, { data: profiles }, { data: { user } }, { data: counts }, { data: settings }] = await Promise.all([
    supabase.from('pets').select('id, name, owners(full_name), sizes(base_minutes)').eq('active', true).order('name'),
    supabase.from('services').select('id, name, extra_minutes').eq('active', true).order('name'),
    supabase.from('profiles').select('id, full_name, role').eq('active', true),
    supabase.auth.getUser(),
    supabase.rpc('pet_bath_counts'),
    supabase.from('settings').select('loyalty_enabled, loyalty_every, loyalty_pct').single()
  ]);
  const baths = new Map<string, number>((counts ?? []).map((c: { pet_id: string; baths: number }) => [c.pet_id, c.baths]));

  const petOptions: PetOption[] = (pets ?? []).map(p => {
    const owner = p.owners as unknown as { full_name: string } | null;
    const size = p.sizes as unknown as { base_minutes: number } | null;
    return { id: p.id, label: `${p.name} (${owner?.full_name ?? 'sin dueño'})`, baseMinutes: size?.base_minutes ?? 60, name: p.name, baths: baths.get(p.id) ?? 0 };
  });
  const serviceOptions: ServiceOption[] = (services ?? []).map(s => ({ id: s.id, name: s.name, extraMinutes: s.extra_minutes }));
  const groomers: GroomerOption[] = (profiles ?? []).map(p => ({ id: p.id, name: groomerName(p) }));

  const loyalty = { enabled: !!settings?.loyalty_enabled, every: settings?.loyalty_every ?? 5, pct: Number(settings?.loyalty_pct ?? 10) };

  return { pets: petOptions, services: serviceOptions, groomers, currentUserId: user?.id ?? '', loyalty };
}
