export const MIN_PASSWORD_LENGTH = 8;

/** Devuelve un mensaje de error, o null si la nueva contraseña es válida. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}
