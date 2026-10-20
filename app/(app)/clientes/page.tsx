import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';

type Row = { id: string; full_name: string; whatsapp: string; active: boolean; pets: { id: string; name: string; active: boolean }[] };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; inactivos?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? '').replace(/[%,()*\\]/g, ' ').trim();
  const showInactive = params.inactivos === '1';
  const supabase = await createClient();

  let query = supabase.from('owners').select('id, full_name, whatsapp, active, pets(id, name, active)').order('full_name');
  if (!showInactive) query = query.eq('active', true);
  if (q) {
    // También encuentra al cliente por el nombre de su mascota.
    const { data: byPet } = await supabase.from('pets').select('owner_id').ilike('name', `%${q}%`);
    const ids = [...new Set((byPet ?? []).map(p => p.owner_id))];
    query = query.or(`full_name.ilike.%${q}%,whatsapp.ilike.%${q}%${ids.length ? `,id.in.(${ids.join(',')})` : ''}`);
  }
  const { data } = await query;
  const owners = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Clientes y mascotas"
        description="Aquí registras a los dueños y a sus mascotas: datos de contacto, raza, tamaño, cuidados especiales y foto. Busca por nombre del cliente, de la mascota o por WhatsApp, y entra a un cliente para ver o editar sus mascotas."
      />

      <div className="toolbar">
        <form action="/clientes" className="search">
          <input name="q" defaultValue={q} placeholder="Buscar por cliente, mascota o WhatsApp" aria-label="Buscar" />
          {showInactive && <input type="hidden" name="inactivos" value="1" />}
          <button className="btn btn-ghost" type="submit">Buscar</button>
        </form>
        <Link className="btn btn-primary" href="/clientes/nuevo">Nuevo cliente</Link>
      </div>
      <p className="muted">
        {showInactive ? <Link href={q ? `/clientes?q=${encodeURIComponent(q)}` : '/clientes'}>Ocultar inactivos</Link>
          : <Link href={`/clientes?${q ? `q=${encodeURIComponent(q)}&` : ''}inactivos=1`}>Mostrar inactivos</Link>}
      </p>

      {owners.length === 0 && (
        <div className="empty">
          <strong>{q ? 'No encontramos resultados.' : 'Todavía no hay clientes.'}</strong>
          <p>{q ? 'Prueba con otro nombre o número.' : 'Aquí puedes registrar a tus clientes y sus mascotas. Pulsa “Nuevo cliente” para crear el primero.'}</p>
        </div>
      )}

      {owners.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Mascotas</th></tr></thead>
            <tbody>
              {owners.map(o => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/clientes/${o.id}`}>{o.full_name}</Link> {!o.active && <span className="badge">Inactivo</span>}
                  </td>
                  <td>{o.whatsapp || <span className="muted">—</span>}</td>
                  <td>{o.pets.filter(p => showInactive || p.active).map(p => p.name).join(', ') || <span className="muted">Sin mascotas</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
