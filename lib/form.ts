export type FormState = { error?: string; ok?: string } | null;

/** Entero >= 0 desde un campo de formulario, o null si no es válido. */
export function parseWhole(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').replace(/[.\s]/g, '').trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

/** Como FormState, pero puede devolver avisos que el usuario decide si ignora. */
export type WarnState = { error?: string; ok?: string; warnings?: string[] } | null;
