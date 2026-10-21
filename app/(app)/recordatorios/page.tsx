import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { whatsappUrl } from '@/lib/phone';
import { TYPE_LABELS, TYPE_ORDER, computeReminders, ownerAgendaMessage } from '@/lib/reminders';
import { addDays, timeOf, toStartsAt, todayStr } from '@/lib/time';
import { MarkSeen } from './MarkSeen';
import { ReminderRow } from './ReminderRow';
import { UndoButton } from './UndoButton';

const DAY_MS = 86400000;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  return days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
}

export default async function RemindersPage() {
  const supabase = await createClient();
  const today = todayStr();
  const { pending, history, excluded, business, ownerPhone } = await computeReminders(supabase, today);

  // Agenda de hoy, para enviársela al dueño del negocio.
  const { data: todays } = await supabase.from('appointments')
    .select('starts_at, pets(name, owners(full_name)), appointment_services(services(name))')
    .eq('status', 'agendada')
    .gte('starts_at', toStartsAt(today, '00:00')).lt('starts_at', toStartsAt(addDays(today, 1), '00:00'))
    .order('starts_at');
  const agenda = ownerAgendaMessage(
    ((todays ?? []) as unknown as { starts_at: string; pets: { name: string; owners: { full_name: string } | null } | null; appointment_services: { services: { name: string } | null }[] }[])
      .map(a => ({
        time: timeOf(a.starts_at), pet: a.pets?.name ?? '', owner: a.pets?.owners?.full_name ?? '',
        services: a.appointment_services.map(s => s.services?.name).filter(Boolean).join(', ')
      })),
    today, business
  );

  const now = Date.now();
  const grouped = TYPE_ORDER.map(type => ({ type, items: pending.filter(r => r.type === type) })).filter(g => g.items.length > 0);

  return (
    <>
      <MarkSeen />
      <PageHeader
        title="Recordatorios"
        description="Aquí ves los mensajes que conviene enviar a tus clientes: citas de mañana, mascotas a las que ya les toca el baño, cumpleaños y clientes que no han vuelto. Pulsa “Enviar por WhatsApp”: se abre el chat con el mensaje ya escrito y el envío queda anotado. Si no hay respuesta, el recordatorio de baño vuelve a salir pasados unos días. Solo aparecen clientes que autorizaron recibir mensajes."
      />

      <div className="toolbar">
        <span className="muted">{pending.length === 0 ? 'No hay recordatorios pendientes.' : `${pending.length} pendiente(s), del más antiguo al más nuevo.`}</span>
        {ownerPhone
          ? <a className="btn btn-ghost" href={whatsappUrl(ownerPhone, agenda)} target="_blank" rel="noopener noreferrer">Enviarme la agenda de hoy</a>
          : <span className="muted">Para recibir tu agenda, pon tu WhatsApp en <Link href="/configuracion">Configuración</Link>.</span>}
      </div>

      {pending.length === 0 && (
        <EmptyState title="Estás al día." pet="gato">
          No hay mensajes por enviar ahora. Cuando haya citas para mañana, mascotas a las que les toque el baño o cumpleaños cerca, aparecerán aquí y la campana te avisará.
        </EmptyState>
      )}

      {grouped.map(g => (
        <section className="panel wide" key={g.type}>
          <h2>{TYPE_LABELS[g.type]} <span className="badge">{g.items.length}</span></h2>
          {g.items.map(r => (
            <ReminderRow
              key={r.key} reminderKey={r.key} href={whatsappUrl(r.whatsapp, r.message)}
              petName={r.petName} ownerName={r.ownerName} info={r.info}
              lastSentText={r.lastSent ? `${fmtDateTime(r.lastSent.at)} (${ago(r.lastSent.at)}) · ${TYPE_LABELS[r.lastSent.type].toLowerCase()}` : null}
            />
          ))}
        </section>
      ))}

      {excluded > 0 && (
        <p className="muted">{excluded} recordatorio(s) no se muestran porque el cliente no autorizó mensajes o no tiene WhatsApp. Puedes cambiarlo en la ficha del cliente.</p>
      )}

      <section className="panel wide">
        <h2>Historial de envíos <small className="muted">(últimos 30 días, del más antiguo al más nuevo)</small></h2>
        {history.length === 0 ? <p className="muted">Todavía no se ha enviado ningún recordatorio.</p> : (
          <div className="table-wrap" style={{ boxShadow: 'none' }}>
            <table className="table">
              <thead><tr><th>Enviado</th><th>Tipo</th><th>Mascota</th><th>Enviado por</th><th /></tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(h.sentAt)} <span className="muted">({ago(h.sentAt)})</span></td>
                    <td>{TYPE_LABELS[h.type]}</td>
                    <td>{h.petName} <span className="muted">({h.ownerName})</span></td>
                    <td>{h.sentBy}</td>
                    <td>{now - new Date(h.sentAt).getTime() < DAY_MS ? <UndoButton id={h.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
