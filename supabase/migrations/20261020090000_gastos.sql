-- Gastos, comprobantes y módulos adicionales.

-- Módulos adicionales que el cliente puede contratar (p. ej. inventario). Solo se cambia desde la base:
--   update public.settings set enabled_modules = '["inventario"]';
-- (la app no tiene permiso para editar esta columna).
alter table public.settings add column enabled_modules jsonb not null default '[]'::jsonb;

-- El cierre guarda cuánto se pagó de gastos con la plata de la caja.
alter table public.cash_closings add column cash_expenses integer not null default 0;

create table public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  expense_date        date not null,
  category_id         uuid references public.expense_categories (id) on delete restrict,
  category_name       text not null,
  description         text not null check (length(trim(description)) > 0),
  amount              integer not null check (amount > 0),
  payment_method_id   uuid references public.payment_methods (id) on delete set null,
  payment_method_name text not null default '',
  from_cash           boolean not null default false,
  supplier            text not null default '',
  receipt_path        text,
  status              text not null default 'registrado' check (status in ('registrado', 'anulado')),
  void_reason         text,
  voided_at           timestamptz,
  voided_by           uuid references public.profiles (id),
  created_by          uuid references public.profiles (id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (expense_date);
create index expenses_category_idx on public.expenses (category_id);
create trigger expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

-- Un gasto pagado de la caja afecta el cierre del día: no se toca si ese día ya está cerrado.
create function public.expenses_closed_day_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.from_cash
     and exists (select 1 from public.cash_closings where closing_date = old.expense_date) then
    raise exception 'El día % ya está cerrado. Reabre el cierre para cambiar o anular gastos pagados de la caja.', old.expense_date;
  end if;
  if new.from_cash
     and exists (select 1 from public.cash_closings where closing_date = new.expense_date) then
    raise exception 'El día % ya está cerrado. Reabre el cierre para registrar o cambiar gastos pagados de la caja.', new.expense_date;
  end if;
  return new;
end $$;
revoke execute on function public.expenses_closed_day_guard() from public, anon, authenticated;

create trigger expenses_guard before insert or update on public.expenses
  for each row execute function public.expenses_closed_day_guard();

-- Solo el administrador ve y maneja gastos. No se borran: se anulan.
alter table public.expenses enable row level security;
create policy expenses_select on public.expenses for select to authenticated using (public.is_admin());
create policy expenses_insert on public.expenses for insert to authenticated with check (public.is_admin());
create policy expenses_update on public.expenses for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Comprobantes (facturas): espacio privado solo para el administrador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin());
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_admin());
create policy receipts_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and public.is_admin());
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_admin());
