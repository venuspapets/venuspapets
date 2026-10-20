export type DayHours = { open: boolean; from: string; to: string };
export type BusinessHours = Record<string, DayHours>;

const DEFAULT_DAY: DayHours = { open: true, from: '08:00', to: '18:00' };

/** Horario de los 7 días (0 = domingo), completando lo que falte. */
export function normalizeHours(raw: unknown): BusinessHours {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Partial<DayHours>>;
  const out: BusinessHours = {};
  for (let d = 0; d < 7; d++) {
    const v = src[String(d)] ?? {};
    out[String(d)] = {
      open: typeof v.open === 'boolean' ? v.open : d !== 0,
      from: v.from ?? DEFAULT_DAY.from,
      to: v.to ?? DEFAULT_DAY.to
    };
  }
  return out;
}
