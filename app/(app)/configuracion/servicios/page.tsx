import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ActionForm } from '@/components/ActionForm';
import { addBreedPrice, removeBreedPrice, saveService } from '../actions';

type Size = { id: string; name: string };
type Service = {
  id: string; name: string; kind: string; extra_minutes: number; active: boolean;
  service_prices: { size_id: string; price: number }[];
  service_breed_prices: { id: string; breed: string; price: number }[];
};

const money = (n: number) => '$' + n.toLocaleString('es-CO');

function ServiceFields({ sizes, service }: { sizes: Size[]; service?: Service }) {
  const priceOf = (sizeId: string) => service?.service_prices.find(p => p.size_id === sizeId)?.price;
  return (
    <>
      <div className="row-form">
        <div className="field"><label>Nombre del servicio</label><input name="name" defaultValue={service?.name} placeholder="ej. Baño completo" required /></div>
        <div className="field">
          <label>Tipo</label>
          <select name="kind" defaultValue={service?.kind ?? 'base'}>
            <option value="base">Principal (baño, corte…)</option>
            <option value="adicional">Adicional (uñas, oídos…)</option>
          </select>
        </div>
        <div className="field"><label>Minutos extra</label><input name="extra_minutes" inputMode="numeric" defaultValue={service?.extra_minutes ?? 0} /></div>
        {service && <label className="check"><input type="checkbox" name="active" defaultChecked={service.active} /> Activo</label>}
      </div>
      <p className="muted">Precio por tamaño (en pesos). Déjalo vacío si el servicio no se ofrece en ese tamaño.</p>
      <div className="row-form">
        {sizes.map(s => (
          <div className="field" key={s.id}>
            <label>{s.name}</label>
            <input name={`price_${s.id}`} inputMode="numeric" defaultValue={priceOf(s.id)} placeholder="$" />
          </div>
        ))}
      </div>
    </>
  );
}

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: sizes }, { data: services }] = await Promise.all([
    supabase.from('sizes').select('id, name').eq('active', true).order('sort_order'),
    supabase.from('services')
      .select('*, service_prices(size_id, price), service_breed_prices(id, breed, price)')
      .order('name')
  ]);
  const list = (services ?? []) as Service[];

  return (
    <>
      <PageHeader
        title="Servicios y precios"
        description="Aquí creas los servicios de tu peluquería y les pones precio según el tamaño de la mascota. Si una raza tiene un precio distinto, agrégalo como precio especial. Los servicios que dejes de ofrecer se desactivan, no se borran, para conservar el historial."
      />

      {list.length === 0 && (
        <div className="empty">
          <strong>Todavía no hay servicios.</strong>
          <p>Aquí puedes crear los servicios y sus precios, por ejemplo “Baño completo” o “Corte de uñas”. Usa el formulario de abajo para crear el primero.</p>
        </div>
      )}

      <section className="panel wide">
        <h2>Nuevo servicio</h2>
        <ActionForm action={saveService} submitLabel="Crear servicio">
          <ServiceFields sizes={sizes ?? []} />
        </ActionForm>
      </section>

      {list.map(svc => (
        <section className="panel wide" key={svc.id}>
          <h2>{svc.name} {!svc.active && <span className="badge">Inactivo</span>}</h2>
          <ActionForm action={saveService}>
            <input type="hidden" name="id" value={svc.id} />
            <ServiceFields sizes={sizes ?? []} service={svc} />
          </ActionForm>

          <h3>Precios especiales por raza</h3>
          {svc.service_breed_prices.length === 0 && <p className="muted">Ninguno. Si una raza cuesta distinto al precio de su tamaño, agrégala aquí.</p>}
          {svc.service_breed_prices.map(b => (
            <ActionForm key={b.id} action={removeBreedPrice} submitLabel="Quitar" buttonClass="btn btn-ghost" className="row-form">
              <input type="hidden" name="id" value={b.id} />
              <span>{b.breed}: <strong>{money(b.price)}</strong></span>
            </ActionForm>
          ))}
          <ActionForm action={addBreedPrice} submitLabel="Agregar raza" buttonClass="btn btn-ghost" className="row-form">
            <input type="hidden" name="service_id" value={svc.id} />
            <div className="field"><input name="breed" placeholder="Raza, ej. Schnauzer" aria-label="Raza" required /></div>
            <div className="field"><input name="price" inputMode="numeric" placeholder="Precio" aria-label="Precio" required /></div>
          </ActionForm>
        </section>
      ))}
    </>
  );
}
