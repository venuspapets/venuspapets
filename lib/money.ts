/** Pesos colombianos: $1.234.567 */
export const money = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

/** Entero desde un campo de texto ("12.500" o "12500"); 0 si está vacío o no es número. */
export function pesos(value: string): number {
  const n = Number(value.replace(/[.\s$]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}
