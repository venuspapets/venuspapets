import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logout } from '../login/actions';
import { supportLink } from '@/lib/contact';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .single();

  // Usuario sin perfil o desactivado: no puede usar la app.
  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  const name = profile.full_name || user.email;
  const roleLabel = profile.role === 'admin' ? 'Administrador' : 'Groomer';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="" width={36} height={36} />
          <span>VenuSpa Pets</span>
        </div>
        <nav>
          <a href="/">Inicio</a>
          <a href="/clientes">Clientes</a>
          {profile.role === 'admin' && <a href="/configuracion">Configuración</a>}
          <a href="/cuenta">Mi cuenta</a>
          <a href={supportLink} target="_blank" rel="noopener noreferrer">Soporte</a>
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <strong>{name}</strong>
            <small>{roleLabel}</small>
          </div>
          <form action={logout}>
            <button className="btn btn-ghost btn-block" type="submit">Salir</button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
