import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { lastBackups } from '@/lib/backups';

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }) : 'Todavía no hay';

export default async function BackupPage() {
  const supabase = await createClient();
  const { auto, manual } = await lastBackups(supabase);

  return (
    <>
      <PageHeader
        title="Copia de seguridad"
        description="Aquí ves el estado de las copias de seguridad y puedes descargar una a mano. Cada domingo en la noche el sistema genera una copia automática de toda la información, la cifra y la envía al correo de la empresa. Los usuarios del sistema no ven ni intervienen en ese proceso."
      />

      <section className="panel wide">
        <h2>Estado</h2>
        <ul className="plain-list">
          <li>Último respaldo automático: <strong>{fmt(auto)}</strong></li>
          <li>Última descarga manual: <strong>{fmt(manual)}</strong></li>
        </ul>
        <p className="muted">La copia automática llega cifrada al correo de la empresa. Sin la contraseña de respaldo no se puede abrir: guárdala en un lugar seguro. Si una semana no llega el correo, descarga una copia manual y avisa a soporte.</p>
      </section>

      <section className="panel wide">
        <h2>Descargar una copia ahora</h2>
        <p>El archivo se descarga en formato JSON y lleva la fecha de hoy. Guárdalo fuera de este computador (por ejemplo en tu correo o en una nube) para que no se pierda si algo le pasa al equipo.</p>
        <p className="muted">No incluye las fotos de las mascotas. Quedan guardadas aparte en el sistema. Para restaurar una copia contacta a soporte.</p>
        <a className="btn btn-primary" href="/configuracion/respaldo/descargar">Descargar respaldo</a>
      </section>
    </>
  );
}
