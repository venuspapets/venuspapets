import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/pets';
import { todayStr } from '@/lib/time';
import { removePromotion, savePromotion, saveDiscountRules } from '../actions';

type Promo = { id: string; name: string; pct: number; starts_on: string; ends_on: string; active: boolean };

function status(p: Promo, today: string) {
  if (!p.active) return 'Desactivada';
  if (today < p.starts_on) return 'Próxima';
  if (today > p.ends_on) return 'Vencida';
  return 'Vigente';
}

function PromoFields({ promo }: { promo?: Promo }) {
  return (
    <>
      {promo && <input type="hidden" name="id" value={promo.id} />}
      <div className="field"><label>Nombre</label><input name="name" defaultValue={promo?.name} placeholder="ej. Navidad" required /></div>
      <div className="field" style={{ flex: '0 0 110px' }}><label>Descuento (%)</label><input name="pct" inputMode="decimal" defaultValue={promo ? Number(promo.pct) : ''} placeholder="10" required /></div>
      <div className="field" style={{ flex: '0 0 160px' }}><label>Desde</label><input name="starts_on" type="date" defaultValue={promo?.starts_on} required /></div>
      <div className="field" style={{ flex: '0 0 160px' }}><label>Hasta</label><input name="ends_on" type="date" defaultValue={promo?.ends_on} required /></div>
      {promo && <label className="check"><input type="checkbox" name="active" defaultChecked={promo.active} /> Activa</label>}
    </>
  );
}

export default async function DiscountsPage() {
  const supabase = await createClient();
  const [{ data: s }, { data: promos }] = await Promise.all([
    supabase.from('settings').select('*').single(),
    supabase.from('promotions').select('*').order('starts_on', { ascending: false })
  ]);
  const today = todayStr();
  const list = (promos ?? []) as Promo[];

  return (
    <>
      <PageHeader
        title="Descuentos y fidelización"
        description="Aquí defines cuándo el sistema sugiere un descuento al cobrar: cada cierto número de baños, en el cumpleaños de la mascota o durante una promoción de temporada. Si varios aplican a la vez, se sugiere el de mayor porcentaje; tú decides si lo aplicas."
      />

      <section className="panel wide">
        <h2>Reglas automáticas</h2>
        <ActionForm action={saveDiscountRules}>
          <h3>Fidelización por número de baños</h3>
          <p className="muted">Cada cobro cuenta como un baño. Cuando el baño sea múltiplo del número que elijas, se sugiere el descuento.</p>
          <div className="row-form">
            <label className="check"><input type="checkbox" name="loyalty_enabled" defaultChecked={s?.loyalty_enabled} /> Activa</label>
            <div className="field" style={{ flex: '0 0 170px' }}><label htmlFor="loyalty_every">Cada cuántos baños</label><input id="loyalty_every" name="loyalty_every" inputMode="numeric" defaultValue={s?.loyalty_every ?? 5} /></div>
            <div className="field" style={{ flex: '0 0 140px' }}><label htmlFor="loyalty_pct">Descuento (%)</label><input id="loyalty_pct" name="loyalty_pct" inputMode="decimal" defaultValue={Number(s?.loyalty_pct ?? 10)} /></div>
          </div>

          <h3>Cumpleaños de la mascota</h3>
          <p className="muted">Se sugiere una sola vez al año, en la semana del cumpleaños (según la fecha de nacimiento de la ficha).</p>
          <div className="row-form">
            <label className="check"><input type="checkbox" name="birthday_enabled" defaultChecked={s?.birthday_enabled} /> Activo</label>
            <div className="field" style={{ flex: '0 0 140px' }}><label htmlFor="birthday_pct">Descuento (%)</label><input id="birthday_pct" name="birthday_pct" inputMode="decimal" defaultValue={Number(s?.birthday_pct ?? 10)} /></div>
            <div className="field" style={{ flex: '0 0 200px' }}><label htmlFor="birthday_window_days">Días antes y después</label><input id="birthday_window_days" name="birthday_window_days" inputMode="numeric" defaultValue={s?.birthday_window_days ?? 7} /></div>
          </div>
        </ActionForm>
      </section>

      <section className="panel wide">
        <h2>Promociones por temporada</h2>
        <p className="muted">Crea una promoción con su porcentaje y sus fechas (Navidad, San Pedro, aniversario…). Aplica a todos los servicios y se sugiere automáticamente mientras esté vigente.</p>

        {list.length === 0 && (
          <EmptyState title="Todavía no hay promociones." pet="gato">
            Aquí puedes crear descuentos por temporada, por ejemplo “Navidad — 15 % del 1 al 24 de diciembre”. Usa el formulario de abajo.
          </EmptyState>
        )}

        {list.map(p => (
          <div key={p.id} className="promo">
            <div className="promo-head">
              <strong>{p.name}</strong> <span className={`badge ${status(p, today) === 'Vigente' ? 'badge-ok' : ''}`}>{status(p, today)}</span>
              <span className="muted"> · {formatDate(p.starts_on)} al {formatDate(p.ends_on)}</span>
            </div>
            <ActionForm action={savePromotion} className="row-form"><PromoFields promo={p} /></ActionForm>
            <ActionForm action={removePromotion} submitLabel="Quitar promoción" buttonClass="btn btn-ghost">
              <input type="hidden" name="id" value={p.id} />
            </ActionForm>
          </div>
        ))}

        <h3>Nueva promoción</h3>
        <ActionForm action={savePromotion} submitLabel="Crear promoción" className="row-form"><PromoFields /></ActionForm>
      </section>
    </>
  );
}
