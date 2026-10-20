import { requireAdmin } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';

const TABS = [
  { href: '/configuracion', label: 'Negocio' },
  { href: '/configuracion/servicios', label: 'Servicios y precios' },
  { href: '/configuracion/descuentos', label: 'Descuentos' },
  { href: '/configuracion/tamanos', label: 'Tamaños' },
  { href: '/configuracion/catalogos', label: 'Pagos y gastos' },
  { href: '/configuracion/respaldo', label: 'Respaldo' }
];

export default async function ConfigLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <Tabs items={TABS} />
      {children}
    </>
  );
}
