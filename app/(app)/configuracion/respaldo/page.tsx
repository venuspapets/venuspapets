import { PageHeader } from '@/components/PageHeader';

export default function BackupPage() {
  return (
    <>
      <PageHeader
        title="Copia de seguridad"
        description="Descarga toda la información del sistema en un archivo para guardarla en un lugar seguro: clientes, mascotas, citas, cobros, cierres de caja, servicios, precios, descuentos y el registro de actividad. Haz una copia con regularidad, por ejemplo cada semana."
      />
      <section className="panel wide">
        <h2>Descargar respaldo</h2>
        <p>El archivo se descarga en formato JSON y lleva la fecha de hoy en el nombre. Guárdalo fuera de este computador (por ejemplo en tu correo o en una nube) para que no se pierda si algo le pasa al equipo.</p>
        <p className="muted">No incluye las fotos de las mascotas. Quedan guardadas aparte en el sistema. Para restaurar una copia contacta a soporte.</p>
        <a className="btn btn-primary" href="/configuracion/respaldo/descargar">Descargar respaldo</a>
      </section>
    </>
  );
}
