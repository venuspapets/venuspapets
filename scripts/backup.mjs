// Exporta todos los datos de la base a un archivo JSON (backup.json).
// Lo usa el respaldo semanal automático (.github/workflows/backup.yml).
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Las fotos no se incluyen.
import { appendFile, writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const TABLES = [
  'settings', 'sizes', 'payment_methods', 'expense_categories', 'services', 'service_prices', 'service_breed_prices',
  'promotions', 'owners', 'pets', 'appointments', 'appointment_services',
  'visits', 'visit_items', 'visit_payments', 'cash_closings', 'activity_log'
];
// Tablas cuya llave primaria no es una columna "id".
const ORDER_BY = {
  service_prices: ['service_id', 'size_id'],
  appointment_services: ['appointment_id', 'service_id']
};
const PAGE = 1000; // Supabase devuelve como máximo 1000 filas por consulta.
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function fetchAll(table, select = '*') {
  const order = (ORDER_BY[table] ?? ['id']).map(c => `${c}.asc`).join(',');
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&order=${order}&limit=${PAGE}&offset=${offset}`, { headers });
    if (!res.ok) throw new Error(`No se pudo leer ${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

const backup = { generado: new Date().toISOString(), version: 1 };
const counts = {};
for (const table of TABLES) {
  backup[table] = await fetchAll(table);
  counts[table] = backup[table].length;
}
// Usuarios: solo lo necesario para identificar a cada persona (sin contraseñas ni correos).
backup.profiles = await fetchAll('profiles', 'id,full_name,role,active,commission_pct');
counts.profiles = backup.profiles.length;

const json = JSON.stringify(backup, null, 2);
await writeFile('backup.json', json);
const bytes = Buffer.byteLength(json);
console.log('Respaldo generado:', JSON.stringify(counts), `(${(bytes / 1024).toFixed(1)} KB)`);

// Deja constancia en el registro de actividad de la app (visible solo para el administrador).
const log = process.env.SKIP_ACTIVITY_LOG ? { ok: true } : await fetch(`${url}/rest/v1/activity_log`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({
    user_name: 'Respaldo automático', action: 'respaldo.automatico', summary: 'Se generó la copia de seguridad semanal',
    details: { counts, kilobytes: Math.round(bytes / 1024) }
  })
});
if (!log.ok) console.warn('No se pudo anotar en el registro de actividad:', log.status);

// Resumen para el correo (lo lee send-backup.mjs).
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `kilobytes=${Math.round(bytes / 1024)}\n`);
