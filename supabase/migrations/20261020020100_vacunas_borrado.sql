-- Cualquier usuario activo puede quitar una vacuna mal registrada.
drop policy vaccines_delete on public.vaccines;
create policy vaccines_delete on public.vaccines for delete to authenticated using (public.is_active_user());
