-- La foto se toma una sola vez, al crear la mascota; el cobro ya no lleva foto.
drop function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, text, jsonb, jsonb);
alter table public.visits drop column photo_path;

create function public.register_visit(
  p_id uuid, p_pet_id uuid, p_appointment_id uuid, p_groomer_id uuid, p_visit_date date,
  p_discount_pct numeric, p_notes text, p_items jsonb, p_payments jsonb
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

  insert into public.visits (id, appointment_id, pet_id, groomer_id, visit_date, subtotal, discount_pct, discount_amount, total, notes)
  values (p_id, p_appointment_id, p_pet_id, p_groomer_id, p_visit_date, v_subtotal, p_discount_pct, v_discount, v_total, coalesce(p_notes, ''));

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

revoke execute on function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, jsonb, jsonb) from public, anon;
grant execute on function public.register_visit(uuid, uuid, uuid, uuid, date, numeric, text, jsonb, jsonb) to authenticated;
