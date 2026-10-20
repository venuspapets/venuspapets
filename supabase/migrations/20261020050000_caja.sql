-- Servicios y caja: cobros (visitas), pagos mixtos, anulaciones con motivo y cierre del día.

alter table public.payment_methods add column is_cash boolean not null default false;
update public.payment_methods set is_cash = true where lower(name) = 'efectivo';

create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid references public.appointments (id) on delete set null,
  pet_id          uuid not null references public.pets (id) on delete restrict,
  groomer_id      uuid references public.profiles (id) on delete set null,
  visit_date      date not null,
  subtotal        integer not null check (subtotal >= 0),
  discount_pct    numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total           integer not null check (total >= 0),
  notes           text not null default '',
  photo_path      text,
  status          text not null default 'cobrado' check (status in ('cobrado', 'anulado')),
  void_reason     text,
  voided_at       timestamptz,
  voided_by       uuid references public.profiles (id),
  created_by      uuid references public.profiles (id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create unique index visits_one_charge_per_appointment on public.visits (appointment_id)
  where appointment_id is not null and status = 'cobrado';
create index visits_date_idx on public.visits (visit_date);
create index visits_pet_idx on public.visits (pet_id);

-- Líneas cobradas: se guarda el nombre y el precio del momento, aunque luego cambie el catálogo.
create table public.visit_items (
  id         uuid primary key default gen_random_uuid(),
  visit_id   uuid not null references public.visits (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  name       text not null,
  price      integer not null check (price >= 0)
);
create index visit_items_visit_idx on public.visit_items (visit_id);

-- Un cobro puede pagarse con varios medios (pagos mixtos).
create table public.visit_payments (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.visits (id) on delete cascade,
  method_id   uuid references public.payment_methods (id) on delete set null,
  method_name text not null,
  is_cash     boolean not null default false,
  amount      integer not null check (amount > 0)
);
create index visit_payments_visit_idx on public.visit_payments (visit_id);

create table public.cash_closings (
  id            uuid primary key default gen_random_uuid(),
  closing_date  date not null unique,
  visits_count  integer not null,
  total_income  integer not null,
  by_method     jsonb not null default '{}'::jsonb,
  expected_cash integer not null default 0,
  counted_cash  integer,
  difference    integer,
  notes         text not null default '',
  closed_by     uuid references public.profiles (id) default auth.uid(),
  closed_at     timestamptz not null default now()
);

-- Seguridad: todos registran cobros; solo el administrador anula y maneja el cierre.
alter table public.visits enable row level security;
alter table public.visit_items enable row level security;
alter table public.visit_payments enable row level security;
alter table public.cash_closings enable row level security;

create policy visits_select on public.visits for select to authenticated using (public.is_active_user());
create policy visits_insert on public.visits for insert to authenticated with check (public.is_active_user());
create policy visits_update on public.visits for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy visit_items_select on public.visit_items for select to authenticated using (public.is_active_user());
create policy visit_items_insert on public.visit_items for insert to authenticated with check (public.is_active_user());
create policy visit_payments_select on public.visit_payments for select to authenticated using (public.is_active_user());
create policy visit_payments_insert on public.visit_payments for insert to authenticated with check (public.is_active_user());

create policy cash_closings_select on public.cash_closings for select to authenticated using (public.is_admin());
create policy cash_closings_insert on public.cash_closings for insert to authenticated with check (public.is_admin());
create policy cash_closings_delete on public.cash_closings for delete to authenticated using (public.is_admin());

-- Registra un cobro completo de forma atómica (todo o nada).
create function public.register_visit(
  p_id uuid, p_pet_id uuid, p_appointment_id uuid, p_groomer_id uuid, p_visit_date date,
  p_discount_pct numeric, p_notes text, p_photo_path text, p_items jsonb, p_payments jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare v_subtotal integer; v_discount integer; v_total integer; v_paid integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un servicio.';
  end if;
  if exists (select 1 from public.cash_closings where closing_date = p_visit_date) then
    raise exception 'El día % ya está cerrado. El administrador debe reabrir el cierre para cobrar.', p_visit_date;
  end if;

  select coalesce(sum((i ->> 'price')::integer), 0) into v_subtotal from jsonb_array_elements(p_items) i;
  v_discount := round(v_subtotal * p_discount_pct / 100);
  v_total := v_subtotal - v_discount;

  insert into public.visits (id, appointment_id, pet_id, groomer_id, visit_date, subtotal, discount_pct, discount_amount, total, notes, photo_path)
  values (p_id, p_appointment_id, p_pet_id, p_groomer_id, p_visit_date, v_subtotal, p_discount_pct, v_discount, v_total, coalesce(p_notes, ''), p_photo_path);

  insert into public.visit_items (visit_id, service_id, name, price)
  select p_id, nullif(i ->> 'service_id', '')::uuid, i ->> 'name', (i ->> 'price')::integer
  from jsonb_array_elements(p_items) i;

  insert into public.visit_payments (visit_id, method_id, method_name, is_cash, amount)
  select p_id, pm.id, pm.name, pm.is_cash, (x ->> 'amount')::integer
  from jsonb_array_elements(p_payments) x
  join public.payment_methods pm on pm.id = (x ->> 'method_id')::uuid
  where (x ->> 'amount')::integer > 0;

  select coalesce(sum(amount), 0) into v_paid from public.visit_payments where visit_id = p_id;
  if v_paid <> v_total then
    raise exception 'Los pagos (%) no suman el total a cobrar (%).', v_paid, v_total;
  end if;

  if p_appointment_id is not null then
    update public.appointments set status = 'atendida' where id = p_appointment_id;
  end if;
  return p_id;
end $$;

-- Anula un cobro (nunca se borra): solo el administrador, con motivo, y si el día no está cerrado.
create function public.void_visit(p_id uuid, p_reason text) returns void
language plpgsql set search_path = '' as $$
declare v public.visits;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede anular cobros.';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Escribe el motivo de la anulación.';
  end if;
  select * into v from public.visits where id = p_id;
  if not found or v.status <> 'cobrado' then
    raise exception 'El cobro no existe o ya está anulado.';
  end if;
  if exists (select 1 from public.cash_closings where closing_date = v.visit_date) then
    raise exception 'El día % ya está cerrado. Reabre el cierre para anular este cobro.', v.visit_date;
  end if;

  update public.visits
     set status = 'anulado', void_reason = trim(p_reason), voided_at = now(), voided_by = auth.uid()
   where id = p_id;
  if v.appointment_id is not null then
    update public.appointments set status = 'agendada' where id = v.appointment_id and status = 'atendida';
  end if;
end $$;

revoke execute on function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.void_visit(uuid, text) from public, anon;
grant execute on function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.void_visit(uuid, text) to authenticated;
