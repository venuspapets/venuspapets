export const STATUSES = [
  { key: 'agendada', label: 'Agendada' },
  { key: 'atendida', label: 'Atendida' },
  { key: 'cancelada', label: 'Cancelada' },
  { key: 'noasistio', label: 'No asistió' }
] as const;

export const statusLabel = (key: string) => STATUSES.find(s => s.key === key)?.label ?? key;

/** Nombre para mostrar de quien atiende (el perfil puede no tener nombre todavía). */
export const groomerName = (p: { full_name: string; role: string }) =>
  p.full_name || (p.role === 'admin' ? 'Administrador' : 'Groomer');
