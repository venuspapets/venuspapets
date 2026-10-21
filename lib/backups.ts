import type { SupabaseClient } from '@supabase/supabase-js';

/** Días después de los cuales se avisa al administrador que falta un respaldo (el automático es semanal). */
export const BACKUP_ALERT_DAYS = 10;

/** Fechas del último respaldo automático y del último descargado a mano, según el registro de actividad. */
export async function lastBackups(supabase: SupabaseClient) {
  const latest = async (action: string) => {
    const { data } = await supabase.from('activity_log').select('created_at').eq('action', action)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data?.created_at as string | undefined;
  };
  const [auto, manual] = await Promise.all([latest('respaldo.automatico'), latest('respaldo.descargado')]);
  const newest = [auto, manual].filter(Boolean).sort().at(-1);
  const daysSince = newest ? Math.floor((Date.now() - new Date(newest).getTime()) / 86400000) : null;
  return { auto, manual, daysSince };
}
