-- Agenda: horario de atención, límite de personas que atienden y citas.

alter table public.settings
  add column business_hours jsonb not null default '{
    "0": {"open": false, "from": "08:00", "to": "18:00"},
    "1": {"open": true,  "from": "08:00", "to": "18:00"},
    "2": {"open": true,  "from": "08:00", "to": "18:00"},
    "3": {"open": true,  "from": "08:00", "to": "18:00"},
    "4": {"open": true,  "from": "08:00", "to": "18:00"},
    "5": {"open": true,  "from": "08:00", "to": "18:00"},
    "6": {"open": true,  "from": "08:00", "to": "18:00"}
  }'::jsonb,
  -- Espacio entre citas de una misma persona: si quedan más cerca, la app avisa.
  add column slot_minutes integer not null default 30 check (slot_minutes between 5 and 120),
  -- Cuántas personas pueden atender (según el plan). Solo se cambia desde la base de datos:
  --   update public.settings set max_groomers = 2;
  add column max_groomers integer not null default 1 check (max_groomers >= 1);

-- La app (administrador) puede editar los datos del negocio, pero no el límite de personas.
revoke update on public.settings from authenticated;
grant update (business_name, owner_name, owner_phone, address, timezone, currency, business_hours, slot_minutes)
  on public.settings to authenticated;

-- Impide tener más usuarios activos que max_groomers.
create function public.enforce_max_groomers() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim integer; cnt integer;
begin
  if new.active and (tg_op = 'INSERT' or not old.active) then
    select max_groomers into lim from public.settings where id;
    select count(*) into cnt from public.profiles where active and id <> new.id;
    if cnt >= lim then
      raise exception 'Se alcanzó el límite de personas que atienden en tu plan (%).', lim;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_max_groomers() from public, anon, authenticated;

create trigger profiles_max_groomers before insert or update on public.profiles
  for each row execute function public.enforce_max_groomers();

-- Citas.
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets (id) on delete restrict,
  groomer_id       uuid references public.profiles (id) on delete set null,
  starts_at        timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status           text not null default 'agendada' check (status in ('agendada', 'atendida', 'cancelada', 'noasistio')),
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_groomer_idx on public.appointments (groomer_id, starts_at);
create index appointments_pet_idx on public.appointments (pet_id);
create trigger appointments_updated before update on public.appointments
  for each row execute function public.set_updated_at();

create table public.appointment_services (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id     uuid not null references public.services (id),
  primary key (appointment_id, service_id)
);

do $$
declare t text;
begin
  foreach t in array array['appointments', 'appointment_services']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_active_user())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_active_user()) with check (public.is_active_user())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_active_user())', t || '_delete', t);
  end loop;
end $$;
