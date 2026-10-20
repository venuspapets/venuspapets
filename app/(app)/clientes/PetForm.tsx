import { ActionForm } from '@/components/ActionForm';
import { TEMPERAMENTS } from '@/lib/pets';
import { savePet } from './actions';

export type PetRow = {
  id: string; owner_id: string; name: string; breed: string; size_id: string | null; birthdate: string | null;
  temperament: string; allergies: string; preferred_cut: string; frequency_days: number; notes: string;
  photo_path: string | null; active: boolean;
};

export function PetForm({ ownerId, pet, sizes }: { ownerId: string; pet?: PetRow; sizes: { id: string; name: string; hint: string }[] }) {
  return (
    <ActionForm action={savePet} submitLabel={pet ? 'Guardar mascota' : 'Crear mascota'}>
      {pet && <input type="hidden" name="id" value={pet.id} />}
      <input type="hidden" name="owner_id" value={ownerId} />
      <div className="row-form">
        <div className="field"><label htmlFor="name">Nombre</label><input id="name" name="name" defaultValue={pet?.name} required /></div>
        <div className="field"><label htmlFor="breed">Raza</label><input id="breed" name="breed" defaultValue={pet?.breed} placeholder="ej. Schnauzer" /></div>
        <div className="field">
          <label htmlFor="size_id">Tamaño</label>
          <select id="size_id" name="size_id" defaultValue={pet?.size_id ?? ''}>
            <option value="">— Sin definir —</option>
            {sizes.map(s => <option key={s.id} value={s.id}>{s.name}{s.hint ? ` (${s.hint})` : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="row-form">
        <div className="field"><label htmlFor="birthdate">Fecha de nacimiento</label><input id="birthdate" name="birthdate" type="date" defaultValue={pet?.birthdate ?? ''} /></div>
        <div className="field">
          <label htmlFor="temperament">Temperamento</label>
          <select id="temperament" name="temperament" defaultValue={pet?.temperament ?? ''}>
            <option value="">— Sin definir —</option>
            {TEMPERAMENTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="frequency_days">Baño cada (días)</label><input id="frequency_days" name="frequency_days" inputMode="numeric" defaultValue={pet?.frequency_days ?? 30} /></div>
      </div>
      <div className="row-form">
        <div className="field"><label htmlFor="preferred_cut">Corte preferido</label><input id="preferred_cut" name="preferred_cut" defaultValue={pet?.preferred_cut} /></div>
        <div className="field"><label htmlFor="allergies">Alergias o cuidados</label><input id="allergies" name="allergies" defaultValue={pet?.allergies} placeholder="ej. piel sensible" /></div>
      </div>
      <div className="field"><label htmlFor="notes">Notas</label><textarea id="notes" name="notes" rows={2} defaultValue={pet?.notes} /></div>
      <div className="field">
        <label htmlFor="photo">{pet?.photo_path ? 'Cambiar foto' : 'Foto'}</label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        <small className="muted">JPG, PNG o WebP de hasta 4 MB.</small>
      </div>
      {pet && <label className="check"><input type="checkbox" name="active" defaultChecked={pet.active} /> Mascota activa</label>}
    </ActionForm>
  );
}
