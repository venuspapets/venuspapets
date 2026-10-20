import type { SupabaseClient } from '@supabase/supabase-js';

export type DiscountType = 'lealtad' | 'cumpleanos' | 'temporada';
export type Suggestion = { type: DiscountType; pct: number; label: string };

export const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  lealtad: 'Lealtad', cumpleanos: 'Cumpleaños', temporada: 'Temporada', manual: 'Manual'
};

const DAY_MS = 86400000;

/** Días entre la fecha y el cumpleaños más cercano (negativo = ya pasó). */
export function daysToBirthday(birthdate: string, date: string): number {
  const [, m, d] = birthdate.split('-').map(Number);
  const year = Number(date.slice(0, 4));
  const target = new Date(`${date}T00:00:00Z`).getTime();
  let best = Infinity;
  for (const y of [year - 1, year, year + 1]) {
    const diff = Math.round((Date.UTC(y, m - 1, d) - target) / DAY_MS);
    if (Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

/**
 * Descuentos que corresponden a una mascota en una fecha: lealtad (cada N baños),
 * cumpleaños (una vez al año, en la ventana configurada) y promociones de temporada vigentes.
 * `best` es el de mayor porcentaje: el que se sugiere.
 */
export async function eligibleDiscounts(
  supabase: SupabaseClient,
  pet: { id: string; name: string; birthdate: string | null },
  date: string
) {
  const [{ data: s }, { count }, { data: promos }] = await Promise.all([
    supabase.from('settings').select('loyalty_enabled, loyalty_every, loyalty_pct, birthday_enabled, birthday_pct, birthday_window_days').single(),
    supabase.from('visits').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id).eq('status', 'cobrado'),
    supabase.from('promotions').select('name, pct').eq('active', true).lte('starts_on', date).gte('ends_on', date)
  ]);

  const bathNumber = (count ?? 0) + 1;
  const options: Suggestion[] = [];

  if (s?.loyalty_enabled && bathNumber % s.loyalty_every === 0) {
    options.push({ type: 'lealtad', pct: Number(s.loyalty_pct), label: `Fidelización: baño #${bathNumber}` });
  }

  if (s?.birthday_enabled && pet.birthdate && Math.abs(daysToBirthday(pet.birthdate, date)) <= s.birthday_window_days) {
    const year = date.slice(0, 4);
    const { count: used } = await supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('pet_id', pet.id).eq('status', 'cobrado').eq('discount_type', 'cumpleanos')
      .gte('visit_date', `${year}-01-01`).lte('visit_date', `${year}-12-31`);
    if (!used) options.push({ type: 'cumpleanos', pct: Number(s.birthday_pct), label: `Cumpleaños de ${pet.name}` });
  }

  for (const p of promos ?? []) options.push({ type: 'temporada', pct: Number(p.pct), label: p.name });

  const best = options.reduce<Suggestion | null>((a, b) => (!a || b.pct > a.pct ? b : a), null);
  return { bathNumber, options, best, every: s?.loyalty_every ?? 5, loyaltyEnabled: !!s?.loyalty_enabled };
}
