import { createClient } from '@/lib/supabase/server';
import { groomerName } from '@/lib/appointments';
import type { GroomerOption, PetOption, ServiceOption } from './AppointmentForm';

/** Datos que necesita el formulario de citas: mascotas, servicios y quién atiende. */
export async function loadFormOptions() {
  const supabase = await createClient();
  const [{ data: pets }, { data: services }, { data: profiles }, { data: { user } }] = await Promise.all([
    supabase.from('pets').select('id, name, owners(full_name), sizes(base_minutes)').eq('active', true).order('name'),
    supabase.from('services').select('id, name, extra_minutes').eq('active', true).order('name'),
    supabase.from('profiles').select('id, full_name, role').eq('active', true),
    supabase.auth.getUser()
  ]);

  const petOptions: PetOption[] = (pets ?? []).map(p => {
    const owner = p.owners as unknown as { full_name: string } | null;
    const size = p.sizes as unknown as { base_minutes: number } | null;
    return { id: p.id, label: `${p.name} (${owner?.full_name ?? 'sin dueño'})`, baseMinutes: size?.base_minutes ?? 60 };
  });
  const serviceOptions: ServiceOption[] = (services ?? []).map(s => ({ id: s.id, name: s.name, extraMinutes: s.extra_minutes }));
  const groomers: GroomerOption[] = (profiles ?? []).map(p => ({ id: p.id, name: groomerName(p) }));

  return { pets: petOptions, services: serviceOptions, groomers, currentUserId: user?.id ?? '' };
}
