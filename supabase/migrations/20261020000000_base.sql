-- Base: perfiles de usuario con rol y configuración del negocio.

create type public.app_role as enum ('admin', 'groomer');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Un perfil por usuario de Supabase Auth.
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  role           public.app_role not null default 'groomer',
  active         boolean not null default true,
  commission_pct numeric(5,2) not null default 0 check (commission_pct between 0 and 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Datos del negocio: una sola fila.
create table public.settings (
  id            boolean primary key default true check (id),
  business_name text not null default 'VenuSpa Pets',
  owner_name    text not null default '',
  owner_phone   text not null default '',
  address       text not null default '',
  timezone      text not null default 'America/Bogota',
  currency      text not null default 'COP',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger settings_updated before update on public.settings
  for each row execute function public.set_updated_at();
insert into public.settings (id) values (true);

-- Ayudas para las políticas de seguridad.
create function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin')
$$;

revoke execute on function public.is_active_user(), public.is_admin() from public, anon;
grant execute on function public.is_active_user(), public.is_admin() to authenticated;

-- Al crear un usuario se crea su perfil (groomer por defecto).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existen antes de esta migración: el primero es el administrador.
insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''),
       case when row_number() over (order by created_at) = 1 then 'admin'::public.app_role else 'groomer' end
from auth.users
on conflict (id) do nothing;

-- Seguridad por filas.
alter table public.profiles enable row level security;
alter table public.settings enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_select on public.settings for select to authenticated
  using (public.is_active_user());
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
