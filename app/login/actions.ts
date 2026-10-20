'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateNewPassword } from '@/lib/password';

export type FormState = { error?: string; ok?: string } | null;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Ingresa tu correo y tu contraseña.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Correo o contraseña incorrectos.' };

  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/** Envía el correo con el enlace para crear una contraseña nueva. */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Ingresa tu correo.' };

  const origin = (await headers()).get('origin') ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/nueva-clave`
  });
  if (error) return { error: 'No se pudo enviar el correo. Espera unos minutos e inténtalo de nuevo.' };

  // Mismo mensaje exista o no el correo, para no revelar qué cuentas existen.
  return { ok: 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.' };
}

/** Fija la contraseña nueva tras abrir el enlace del correo (la sesión viene del enlace). */
export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get('password') ?? '');
  const invalid = validateNewPassword(password, String(formData.get('confirm') ?? ''));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'No se pudo cambiar la contraseña. Pide un enlace nuevo e inténtalo otra vez.' };

  redirect('/');
}
