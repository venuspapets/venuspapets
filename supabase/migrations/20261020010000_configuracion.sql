-- Configuración: tamaños, medios de pago, categorías de gastos y catálogo de servicios.
-- Nada se borra de forma definitiva: se desactiva, para no romper el historial futuro.

create table public.sizes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  hint         text not null default '',
  base_minutes integer not null check (base_minutes > 0),
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index sizes_name_key on public.sizes (lower(name));

create table public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index payment_methods_name_key on public.payment_methods (lower(name));

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index expense_categories_name_key on public.expense_categories (lower(name));

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  kind          text not null default 'base' check (kind in ('base', 'adicional')),
  extra_minutes integer not null default 0 check (extra_minutes >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index services_name_key on public.services (lower(name));

-- Precio de un servicio según el tamaño de la mascota.
create table public.service_prices (
  service_id uuid not null references public.services (id) on delete cascade,
  size_id    uuid not null references public.sizes (id),
  price      integer not null check (price >= 0),
  primary key (service_id, size_id)
);

-- Precio especial de un servicio para una raza (tiene prioridad sobre el de tamaño).
create table public.service_breed_prices (
  id         uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  breed      text not null check (length(trim(breed)) > 0),
  price      integer not null check (price >= 0)
);
create unique index service_breed_prices_key on public.service_breed_prices (service_id, lower(breed));

-- Valores iniciales (todos editables desde la app).
insert into public.sizes (name, hint, base_minutes, sort_order) values
  ('Pequeño', 'hasta ~10 kg', 60, 1),
  ('Mediano', '10 a 25 kg', 75, 2),
  ('Grande', '25 a 40 kg', 90, 3),
  ('Gigante', 'más de 40 kg', 120, 4);

insert into public.payment_methods (name, sort_order) values
  ('Efectivo', 1), ('Transferencia', 2), ('Tarjeta', 3);

insert into public.expense_categories (name, sort_order) values
  ('Arriendo', 1), ('Servicios públicos', 2), ('Sueldos', 3), ('Publicidad', 4),
  ('Transporte', 5), ('Mantenimiento', 6), ('Insumos', 7), ('Otros', 8);

-- Seguridad: lo ve cualquier usuario activo; solo el administrador modifica.
do $$
declare t text;
begin
  foreach t in array array['sizes', 'payment_methods', 'expense_categories', 'services', 'service_prices', 'service_breed_prices']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_delete', t);
  end loop;
end $$;
