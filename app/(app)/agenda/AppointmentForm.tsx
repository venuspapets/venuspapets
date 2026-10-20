'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { WarningDialog } from '@/components/WarningDialog';
import { STATUSES } from '@/lib/appointments';
import { saveAppointment, type AppointmentState } from './actions';

export type PetOption = { id: string; label: string; baseMinutes: number; name: string; baths: number };
export type Loyalty = { enabled: boolean; every: number; pct: number };
export type ServiceOption = { id: string; name: string; extraMinutes: number };
export type GroomerOption = { id: string; name: string };
export type AppointmentValues = {
  id?: string; pet_id: string; date: string; time: string; duration: number;
  groomer_id: string; service_ids: string[]; notes: string; status: string;
};

export function AppointmentForm({ pets, services, groomers, values, loyalty }: {
  pets: PetOption[]; services: ServiceOption[]; groomers: GroomerOption[]; values: AppointmentValues; loyalty: Loyalty;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<AppointmentState>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  const [petId, setPetId] = useState(values.pet_id);
  const [selected, setSelected] = useState<string[]>(values.service_ids);
  const [duration, setDuration] = useState(String(values.duration));
  const [touched, setTouched] = useState(!!values.id);

  // La duración sugerida es el tiempo base del tamaño más los minutos extra de cada servicio.
  useEffect(() => {
    if (touched) return;
    const base = pets.find(p => p.id === petId)?.baseMinutes ?? 60;
    const extra = services.filter(s => selected.includes(s.id)).reduce((sum, s) => sum + s.extraMinutes, 0);
    setDuration(String(base + extra));
  }, [petId, selected, touched, pets, services]);

  function submit(confirm: boolean) {
    const fd = new FormData(formRef.current!);
    if (confirm) fd.set('confirm', '1');
    startTransition(async () => {
      setState(await saveAppointment(null, fd));
      setDismissed(false);
    });
  }

  // Si la cita ya fue atendida, su baño ya está contado: no se anuncia el siguiente.
  const selectedPet = pets.find(p => p.id === petId);
  const nextBath = selectedPet && values.status !== 'atendida' ? selectedPet.baths + 1 : null;
  const rewarded = nextBath !== null && loyalty.enabled && nextBath % loyalty.every === 0;

  const warnings = state?.warnings && !dismissed ? state.warnings : null;

  function changeTime() {
    setDismissed(true);
    timeRef.current?.focus();
  }

  return (
    <form ref={formRef} onSubmit={e => { e.preventDefault(); submit(false); }}>
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="row-form">
        <div className="field" style={{ flexBasis: '260px' }}>
          <label htmlFor="pet_id">Mascota</label>
          <select id="pet_id" name="pet_id" value={petId} onChange={e => setPetId(e.target.value)} required>
            <option value="">— Elige una mascota —</option>
            {pets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {selectedPet && nextBath !== null && (
            <div className={rewarded ? 'info-box info-reward' : 'info-box'}>
              Este es el baño número <strong>{nextBath}</strong> de {selectedPet.name}.
              {rewarded && <> Le corresponde un descuento sugerido de <strong>{loyalty.pct}%</strong> por fidelización.</>}
            </div>
          )}
        </div>
        {groomers.length > 1 ? (
          <div className="field">
            <label htmlFor="groomer_id">Atiende</label>
            <select id="groomer_id" name="groomer_id" defaultValue={values.groomer_id}>
              {groomers.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        ) : (
          <input type="hidden" name="groomer_id" value={groomers[0]?.id ?? ''} />
        )}
      </div>

      <div className="row-form">
        <div className="field"><label htmlFor="date">Fecha</label><input id="date" name="date" type="date" defaultValue={values.date} required /></div>
        <div className="field"><label htmlFor="time">Hora</label><input id="time" ref={timeRef} name="time" type="time" step={300} defaultValue={values.time} required /></div>
        <div className="field">
          <label htmlFor="duration">Duración (minutos)</label>
          <input id="duration" name="duration" inputMode="numeric" value={duration} onChange={e => { setTouched(true); setDuration(e.target.value); }} required />
        </div>
      </div>

      <fieldset className="field services-box">
        <legend>Servicios</legend>
        {services.length === 0 && <p className="muted">No hay servicios creados. Créalos en Configuración → Servicios y precios.</p>}
        {services.map(s => (
          <label key={s.id} className="check">
            <input
              type="checkbox" name="service_id" value={s.id}
              checked={selected.includes(s.id)}
              onChange={e => setSelected(cur => e.target.checked ? [...cur, s.id] : cur.filter(x => x !== s.id))}
            />
            {s.name}{s.extraMinutes > 0 && <span className="muted"> (+{s.extraMinutes} min)</span>}
          </label>
        ))}
      </fieldset>

      {values.id && (
        <div className="field">
          <label htmlFor="status">Estado</label>
          <select id="status" name="status" defaultValue={values.status}>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      )}

      <div className="field"><label htmlFor="notes">Notas</label><textarea id="notes" name="notes" rows={2} defaultValue={values.notes} /></div>

      {state?.error && <div className="login-error" role="alert">{state.error}</div>}
      {state?.ok && <div className="login-ok" role="status">{state.ok}</div>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Guardando…' : values.id ? 'Guardar cita' : 'Agendar cita'}
        </button>
      </div>

      {warnings && (
        <WarningDialog
          warnings={warnings} question="¿Quieres agendar de todos modos?"
          confirmLabel="Sí, agendar" cancelLabel="No, cambiar la hora" pending={pending}
          onConfirm={() => submit(true)} onCancel={changeTime}
        />
      )}
    </form>
  );
}
