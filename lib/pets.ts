export const TEMPERAMENTS = ['Tranquilo', 'Juguetón', 'Nervioso', 'Agresivo'];

/** Edad legible a partir de la fecha de nacimiento (yyyy-mm-dd). */
export function ageLabel(birthdate: string | null): string {
  if (!birthdate) return '';
  const born = new Date(birthdate + 'T00:00:00');
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months--;
  if (months < 0) return '';
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

export function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
