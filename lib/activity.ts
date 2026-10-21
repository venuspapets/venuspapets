import type { SupabaseClient } from '@supabase/supabase-js';
import { groomerName } from '@/lib/appointments';

export type ActivityInput = {
  action: string;          // ej. 'cobro.registrado'
  entity?: string;         // ej. 'visit'
  entityId?: string;
  summary: string;         // frase legible para mostrar
  details?: Record<string, unknown>;
};

/** Etiquetas legibles de cada acción, para filtrar y mostrar el registro. */
export const ACTION_LABELS: Record<string, string> = {
  'cobro.registrado': 'Cobro registrado',
  'cobro.anulado': 'Cobro anulado',
  'caja.cierre': 'Cierre del día',
  'caja.reapertura': 'Cierre reabierto',
  'cita.creada': 'Cita creada',
  'cita.editada': 'Cita editada',
  'cliente.creado': 'Cliente creado',
  'cliente.editado': 'Cliente editado',
  'mascota.creada': 'Mascota creada',
  'mascota.editada': 'Mascota editada',
  'config.negocio': 'Configuración del negocio',
  'config.servicio': 'Servicio o precios',
  'config.tamano': 'Tamaños',
  'config.catalogo': 'Medios de pago y gastos',
  'config.descuentos': 'Reglas de descuento',
  'config.promocion': 'Promociones',
  'respaldo.descargado': 'Respaldo descargado',
  'respaldo.automatico': 'Respaldo automático'
};

/**
 * Anota quién hizo qué. Nunca interrumpe la operación principal: si el registro falla,
 * solo queda el aviso en el servidor.
 */
export async function logActivity(supabase: SupabaseClient, input: ActivityInput) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
    const { error } = await supabase.from('activity_log').insert({
      user_id: user.id,
      user_name: profile ? groomerName(profile) : user.email ?? '',
      action: input.action,
      entity: input.entity ?? '',
      entity_id: input.entityId ?? null,
      summary: input.summary,
      details: input.details ?? {}
    });
    if (error) console.error('No se pudo registrar la actividad:', error.message);
  } catch (e) {
    console.error('No se pudo registrar la actividad:', e);
  }
}
