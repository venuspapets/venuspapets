import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Módulos adicionales que el cliente puede contratar (por ejemplo "inventario").
 * Se activan solo desde la base de datos, nunca desde la app:
 *   update public.settings set enabled_modules = '["inventario"]';
 */
export async function isModuleEnabled(supabase: SupabaseClient, name: string): Promise<boolean> {
  const { data } = await supabase.from('settings').select('enabled_modules').single();
  return Array.isArray(data?.enabled_modules) && data.enabled_modules.includes(name);
}
