-- Clientes (dueños), mascotas y vacunas. Nada se borra: se desactiva.

create table public.owners (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (length(trim(full_name)) > 0),
  whatsapp         text not null default '',
  address          text not null default '',
  birthday         date,
  consent_messages boolean not null default true,
  referred_by      uuid references public.owners (id) on delete set null,
  notes            text not null default '',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index owners_name_idx on public.owners (lower(full_name));
create index owners_whatsapp_idx on public.owners (whatsapp);
create trigger owners_updated before update on public.owners
  for each row execute function public.set_updated_at();

create table public.pets (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.owners (id) on delete restrict,
  name           text not null check (length(trim(name)) > 0),
  breed          text not null default '',
  size_id        uuid references public.sizes (id),
  birthdate      date,
  temperament    text not null default '',
  allergies      text not null default '',
  preferred_cut  text not null default '',
  frequency_days integer not null default 30 check (frequency_days > 0),
  notes          text not null default '',
  photo_path     text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index pets_owner_idx on public.pets (owner_id);
create index pets_name_idx on public.pets (lower(name));
create trigger pets_updated before update on public.pets
  for each row execute function public.set_updated_at();

create table public.vaccines (
  id         uuid primary key default gen_random_uuid(),
  pet_id     uuid not null references public.pets (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  applied_on date,
  next_due   date,
  created_at timestamptz not null default now()
);
create index vaccines_pet_idx on public.vaccines (pet_id);

-- Seguridad: administrador y groomers trabajan con clientes; solo el administrador borra.
do $$
declare t text;
begin
  foreach t in array array['owners', 'pets', 'vaccines']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_active_user())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_active_user()) with check (public.is_active_user())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Fotos de mascotas: espacio privado (se muestran con enlaces temporales).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy pet_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'pet-photos' and public.is_active_user());
create policy pet_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-photos' and public.is_active_user());
create policy pet_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'pet-photos' and public.is_active_user());
create policy pet_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pet-photos' and public.is_active_user());
