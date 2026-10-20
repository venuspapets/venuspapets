// Aplica las migraciones de supabase/migrations que aún no están en la base.
// Usa la API de gestión de Supabase (SUPABASE_ACCESS_TOKEN) y registra cada una
// en supabase_migrations.schema_migrations, igual que la CLI oficial.
import { readdir, readFile } from 'node:fs/promises';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_ACCESS_TOKEN en .env.local');
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return JSON.parse(body);
}

await query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text
  );`);

const applied = new Set((await query('select version from supabase_migrations.schema_migrations')).map(r => r.version));
const dir = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();

let count = 0;
for (const file of files) {
  const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
  if (applied.has(version)) continue;
  const sql = await readFile(new URL(file, dir), 'utf8');
  console.log('Aplicando', file);
  const tag = `$m${Date.now()}$`;
  await query(`${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements)
    values ('${version}', '${rest.join('_')}', array[${tag}${sql}${tag}]);`);
  count++;
}
console.log(count ? `Listo: ${count} migración(es) aplicada(s).` : 'Base de datos al día.');
