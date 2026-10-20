-- Fidelización y descuentos: reglas editables, promociones por temporada y trazabilidad en cada cobro.

alter table public.settings
  add column loyalty_enabled boolean not null default true,
  add column loyalty_every integer not null default 5 check (loyalty_every >= 1),
  add column loyalty_pct numeric(5,2) not null default 10 check (loyalty_pct > 0 and loyalty_pct <= 100),
  add column birthday_enabled boolean not null default true,
  add column birthday_pct numeric(5,2) not null default 10 check (birthday_pct > 0 and birthday_pct <= 100),
  add column birthday_window_days integer not null default 7 check (birthday_window_days between 0 and 30);

-- max_groomers sigue sin poder editarse desde la app.
grant update (loyalty_enabled, loyalty_every, loyalty_pct, birthday_enabled, birthday_pct, birthday_window_days)
  on public.settings to authenticated;

-- Promociones por temporada (Navidad, San Pedro, aniversario…).
create table public.promotions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  pct        numeric(5,2) not null check (pct > 0 and pct <= 100),
  starts_on  date not null,
  ends_on    date not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index promotions_dates_idx on public.promotions (starts_on, ends_on);

alter table public.promotions enable row level security;
create policy promotions_select on public.promotions for select to authenticated using (public.is_active_user());
create policy promotions_insert on public.promotions for insert to authenticated with check (public.is_admin());
create policy promotions_update on public.promotions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy promotions_delete on public.promotions for delete to authenticated using (public.is_admin());

-- Cada cobro guarda qué descuento se aplicó, cuál se sugería y, si fue manual, el motivo.
alter table public.visits
  add column discount_type text check (discount_type in ('lealtad', 'cumpleanos', 'temporada', 'manual')),
  add column discount_label text,
  add column discount_reason text,
  add column suggested_pct numeric(5,2),
  add column suggested_label text;

drop function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, jsonb, jsonb);

create function public.register_visit(
  p_id uuid, p_pet_id uuid, p_appointment_id uuid, p_groomer_id uuid, p_visit_date date,
  p_discount_pct numeric, p_discount_type text, p_discount_label text, p_discount_reason text,
  p_suggested_pct numeric, p_suggested_label text,
  p_notes text, p_items jsonb, p_payments jsonb
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
  if p_discount_pct > 0 and p_discount_type is null then
    raise exception 'El descuento necesita un tipo.';
  end if;
  if p_discount_type = 'manual' and length(trim(coalesce(p_discount_reason, ''))) = 0 then
    raise exception 'Escribe el motivo del descuento manual.';
  end if;

  select coalesce(sum((i ->> 'price')::integer), 0) into v_subtotal from jsonb_array_elements(p_items) i;
  v_discount := round(v_subtotal * p_discount_pct / 100);
  v_total := v_subtotal - v_discount;

  insert into public.visits (
    id, appointment_id, pet_id, groomer_id, visit_date, subtotal, discount_pct, discount_amount, total, notes,
    discount_type, discount_label, discount_reason, suggested_pct, suggested_label
  ) values (
    p_id, p_appointment_id, p_pet_id, p_groomer_id, p_visit_date, v_subtotal, p_discount_pct, v_discount, v_total, coalesce(p_notes, ''),
    case when p_discount_pct > 0 then p_discount_type end,
    case when p_discount_pct > 0 then p_discount_label end,
    case when p_discount_pct > 0 then nullif(trim(coalesce(p_discount_reason, '')), '') end,
    p_suggested_pct, p_suggested_label
  );

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

revoke execute on function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, jsonb, jsonb) to authenticated;

-- Cuántos baños (cobros no anulados) lleva cada mascota.
create function public.pet_bath_counts() returns table (pet_id uuid, baths integer)
language sql stable set search_path = '' as $$
  select pet_id, count(*)::integer from public.visits where status = 'cobrado' group by pet_id
$$;
revoke execute on function public.pet_bath_counts() from public, anon;
grant execute on function public.pet_bath_counts() to authenticated;
