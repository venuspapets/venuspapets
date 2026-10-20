'use server';

import { createClient } from '@/lib/supabase/server';
import { validateNewPassword } from '@/lib/password';
import type { FormState } from '@/lib/form';

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = String(formData.get('current') ?? '');
  const password = String(formData.get('password') ?? '');
  const invalid = validateNewPassword(password, String(formData.get('confirm') ?? ''));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Tu sesión venció. Vuelve a iniciar sesión.' };

  // Confirma que quien cambia la clave conoce la actual.
  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (authError) return { error: 'La contraseña actual no es correcta.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.' };

  return { ok: 'Contraseña actualizada.' };
}
