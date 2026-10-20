import { ActionForm } from '@/components/ActionForm';
import { saveOwner } from './actions';

export type OwnerRow = {
  id: string; full_name: string; whatsapp: string; address: string; birthday: string | null;
  consent_messages: boolean; referred_by: string | null; notes: string; active: boolean;
};

export function OwnerForm({ owner, others }: { owner?: OwnerRow; others: { id: string; full_name: string }[] }) {
  return (
    <ActionForm action={saveOwner} submitLabel={owner ? 'Guardar cliente' : 'Crear cliente'}>
      {owner && <input type="hidden" name="id" value={owner.id} />}
      <div className="row-form">
        <div className="field"><label htmlFor="full_name">Nombre completo</label><input id="full_name" name="full_name" defaultValue={owner?.full_name} required /></div>
        <div className="field">
          <label htmlFor="whatsapp">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" inputMode="tel" defaultValue={owner?.whatsapp} placeholder="3001234567" />
        </div>
      </div>
      <div className="row-form">
        <div className="field"><label htmlFor="address">Dirección</label><input id="address" name="address" defaultValue={owner?.address} /></div>
        <div className="field"><label htmlFor="birthday">Cumpleaños</label><input id="birthday" name="birthday" type="date" defaultValue={owner?.birthday ?? ''} /></div>
      </div>
      <div className="row-form">
        <div className="field">
          <label htmlFor="referred_by">Referido por</label>
          <select id="referred_by" name="referred_by" defaultValue={owner?.referred_by ?? ''}>
            <option value="">— Nadie —</option>
            {others.filter(o => o.id !== owner?.id).map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor="notes">Notas</label><textarea id="notes" name="notes" rows={2} defaultValue={owner?.notes} /></div>
      <label className="check"><input type="checkbox" name="consent_messages" defaultChecked={owner?.consent_messages ?? true} /> Autoriza recibir mensajes por WhatsApp (recordatorios y promociones)</label>
      {owner && <label className="check"><input type="checkbox" name="active" defaultChecked={owner.active} /> Cliente activo</label>}
    </ActionForm>
  );
}
