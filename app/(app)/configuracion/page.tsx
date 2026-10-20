import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { normalizeHours } from '@/lib/hours';
import { DAY_NAMES } from '@/lib/time';
import { saveBusiness } from './actions';

// Se muestra de lunes a domingo (en la base 0 = domingo).
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function BusinessPage() {
  const supabase = await createClient();
  const { data: s } = await supabase.from('settings').select('*').single();
  const hours = normalizeHours(s?.business_hours);

  return (
    <>
      <PageHeader
        title="Configuración del negocio"
        description="Aquí defines los datos de tu peluquería, tu horario de atención y el espacio mínimo entre citas. El WhatsApp del dueño se usa para avisarte de las citas nuevas y para el resumen de la agenda."
      />
      <section className="panel wide">
        <ActionForm action={saveBusiness}>
          <h2>Datos</h2>
          <div className="row-form">
            <div className="field">
              <label htmlFor="business_name">Nombre del negocio</label>
              <input id="business_name" name="business_name" defaultValue={s?.business_name ?? ''} required />
            </div>
            <div className="field">
              <label htmlFor="owner_name">Nombre del dueño</label>
              <input id="owner_name" name="owner_name" defaultValue={s?.owner_name ?? ''} />
            </div>
          </div>
          <div className="row-form">
            <div className="field">
              <label htmlFor="owner_phone">WhatsApp del dueño</label>
              <input id="owner_phone" name="owner_phone" inputMode="tel" defaultValue={s?.owner_phone ?? ''} placeholder="3001234567" />
              <small className="muted">Escríbelo con 10 dígitos; el indicativo de Colombia (57) se agrega solo.</small>
            </div>
            <div className="field">
              <label htmlFor="address">Dirección</label>
              <input id="address" name="address" defaultValue={s?.address ?? ''} />
            </div>
          </div>

          <h2>Horario de atención</h2>
          <p className="muted">Marca los días que atiendes y la hora de apertura y cierre. La agenda te avisa si agendas una cita fuera de este horario.</p>
          {ORDER.map(d => (
            <div className="row-form hours-row" key={d}>
              <label className="check hours-day">
                <input type="checkbox" name={`open_${d}`} defaultChecked={hours[String(d)].open} /> {DAY_NAMES[d]}
              </label>
              <div className="field"><input type="time" name={`from_${d}`} defaultValue={hours[String(d)].from} aria-label={`Abre el ${DAY_NAMES[d]}`} /></div>
              <span>a</span>
              <div className="field"><input type="time" name={`to_${d}`} defaultValue={hours[String(d)].to} aria-label={`Cierra el ${DAY_NAMES[d]}`} /></div>
            </div>
          ))}

          <h2>Espacio entre citas</h2>
          <div className="row-form">
            <div className="field">
              <label htmlFor="slot_minutes">Minutos</label>
              <input id="slot_minutes" name="slot_minutes" inputMode="numeric" defaultValue={s?.slot_minutes ?? 30} />
              <small className="muted">Si dos citas de la misma persona quedan más cerca que esto, la agenda te avisa antes de guardar. También es el tamaño de cada fila de la agenda.</small>
            </div>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
