import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Exige un administrador activo; si no lo es, redirige. Devuelve el cliente de Supabase. */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, active').eq('id', user.id).single();
  if (!profile?.active || profile.role !== 'admin') redirect('/');
  return supabase;
}

/** true si el usuario con sesión es administrador activo. */
export async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('role, active').eq('id', user.id).single();
  return !!data?.active && data.role === 'admin';
}
