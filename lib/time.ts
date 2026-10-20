// Colombia no tiene horario de verano: siempre UTC-5.
export const TZ = 'America/Bogota';
const OFFSET = '-05:00';

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** ISO con zona a partir de fecha (yyyy-mm-dd) y hora (HH:MM) de Colombia. */
export const toStartsAt = (date: string, time: string) => new Date(`${date}T${time}:00${OFFSET}`).toISOString();

export function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function dateOf(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
}

export function timeOf(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function weekStart(date: string) {
  const w = weekday(date);
  return addDays(date, w === 0 ? -6 : 1 - w);
}

export function isValidDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

export function formatDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function formatShortDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "HH:MM" → minutos desde la medianoche. */
export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

export function addMinutesIso(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}
