-- Registro de actividad (inmutable) y tope de descuento manual para quienes no son administradores.

create table public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  user_name  text not null default '',
  action     text not null,
  entity     text not null default '',
  entity_id  text,
  summary    text not null,
  details    jsonb not null default '{}'::jsonb
);
create index activity_created_idx on public.activity_log (created_at desc);
create index activity_action_idx on public.activity_log (action);

alter table public.activity_log enable row level security;
-- Solo el administrador lo lee; cualquiera lo alimenta con su propio usuario; nadie lo edita ni lo borra.
create policy activity_select on public.activity_log for select to authenticated using (public.is_admin());
create policy activity_insert on public.activity_log for insert to authenticated
  with check (public.is_active_user() and user_id = auth.uid());

alter table public.settings
  add column groomer_discount_cap numeric(5,2) not null default 20 check (groomer_discount_cap between 0 and 100);
grant update (groomer_discount_cap) on public.settings to authenticated;

-- Mismo registro de cobros, ahora con el tope al descuento manual de quien no es administrador.
create or replace function public.register_visit(
  p_id uuid, p_pet_id uuid, p_appointment_id uuid, p_groomer_id uuid, p_visit_date date,
  p_discount_pct numeric, p_discount_type text, p_discount_label text, p_discount_reason text,
  p_suggested_pct numeric, p_suggested_label text,
  p_notes text, p_items jsonb, p_payments jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare v_subtotal integer; v_discount integer; v_total integer; v_paid integer; v_cap numeric;
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
  if p_discount_type = 'manual' and p_discount_pct > 0 and not public.is_admin() then
    select groomer_discount_cap into v_cap from public.settings where id;
    if p_discount_pct > v_cap then
      raise exception 'Solo el administrador puede dar un descuento manual mayor al % %%.', v_cap;
    end if;
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
