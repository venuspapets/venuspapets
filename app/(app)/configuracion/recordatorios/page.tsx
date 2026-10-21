import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { saveReminderRules } from '../actions';

export default async function ReminderSettingsPage() {
  const supabase = await createClient();
  const { data: s } = await supabase.from('settings').select('reminder_repeat_days, reactivation_first, reactivation_second').single();

  return (
    <>
      <PageHeader
        title="Reglas de recordatorios"
        description="Define cada cuánto se vuelve a recordar un baño y cuándo se considera que un cliente dejó de venir. El texto de los mensajes lo arma el sistema con los datos de la mascota y del dueño."
      />
      <section className="panel wide">
        <ActionForm action={saveReminderRules}>
          <h3>Volver a recordar el baño</h3>
          <p className="muted">Cuando a una mascota le toca el baño y se le envía el recordatorio, si el cliente no agenda, vuelve a aparecer pasados estos días. Las citas, los cumpleaños y la reactivación se avisan una sola vez.</p>
          <div className="row-form">
            <div className="field" style={{ flex: '0 0 220px' }}><label htmlFor="reminder_repeat_days">Días para volver a recordar</label><input id="reminder_repeat_days" name="reminder_repeat_days" inputMode="numeric" defaultValue={s?.reminder_repeat_days ?? 7} /></div>
          </div>

          <h3>Clientes que no han vuelto</h3>
          <p className="muted">Se cuentan los días de retraso desde la fecha en que a la mascota le tocaba el baño (según los días entre baños de su ficha). Se avisa en dos momentos.</p>
          <div className="row-form">
            <div className="field" style={{ flex: '0 0 220px' }}><label htmlFor="reactivation_first">Primer aviso (días de retraso)</label><input id="reactivation_first" name="reactivation_first" inputMode="numeric" defaultValue={s?.reactivation_first ?? 30} /></div>
            <div className="field" style={{ flex: '0 0 220px' }}><label htmlFor="reactivation_second">Segundo aviso (días de retraso)</label><input id="reactivation_second" name="reactivation_second" inputMode="numeric" defaultValue={s?.reactivation_second ?? 60} /></div>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
