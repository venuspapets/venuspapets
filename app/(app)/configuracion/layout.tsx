import { requireAdmin } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';

const TABS = [
  { href: '/configuracion', label: 'Negocio' },
  { href: '/configuracion/servicios', label: 'Servicios y precios' },
  { href: '/configuracion/tamanos', label: 'Tamaños' },
  { href: '/configuracion/catalogos', label: 'Pagos y gastos' }
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
