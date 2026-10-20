import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { todayStr } from '@/lib/time';

// Tablas que se incluyen, en un orden que respeta las relaciones.
const TABLES = [
  'settings', 'sizes', 'payment_methods', 'expense_categories', 'services', 'service_prices', 'service_breed_prices',
  'promotions', 'owners', 'pets', 'appointments', 'appointment_services',
  'visits', 'visit_items', 'visit_payments', 'cash_closings', 'activity_log'
];
// Tablas cuya llave primaria no es una columna "id".
const ORDER_BY: Record<string, string[]> = {
  service_prices: ['service_id', 'size_id'],
  appointment_services: ['appointment_id', 'service_id'],
  settings: ['id']
};
const PAGE = 1000; // Supabase devuelve como máximo 1000 filas por consulta.

/** Respaldo completo en JSON. Solo administrador. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('role, active').eq('id', user.id).single()
    : { data: null };
  if (!profile?.active || profile.role !== 'admin') return new Response('No autorizado', { status: 403 });

  const backup: Record<string, unknown> = { generado: new Date().toISOString(), version: 1 };
  const counts: Record<string, number> = {};

  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      // Orden fijo por llave primaria para que la paginación no repita ni se salte filas.
      let query = supabase.from(table).select('*');
      for (const col of ORDER_BY[table] ?? ['id']) query = query.order(col, { ascending: true });
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) return new Response(`No se pudo leer la tabla ${table}`, { status: 500 });
      rows.push(...(data ?? []));
      if ((data ?? []).length < PAGE) break;
    }
    backup[table] = rows;
    counts[table] = rows.length;
  }

  // Usuarios: solo lo necesario para identificar a cada persona (sin contraseñas ni correos).
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role, active, commission_pct');
  backup.profiles = profiles ?? [];

  await logActivity(supabase, { action: 'respaldo.descargado', summary: 'Descargó una copia de seguridad', details: counts });

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="respaldo-venuspa-${todayStr()}.json"`
    }
  });
}
