-- Solo se pueden eliminar citas que siguen programadas. Las atendidas, canceladas o con
-- "no asistió" son historial y se conservan.
create function public.appointments_delete_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'agendada' then
    raise exception 'Solo se pueden eliminar citas programadas. Esta cita ya está marcada como %.', old.status;
  end if;
  return old;
end $$;

create trigger appointments_delete_guard before delete on public.appointments
  for each row execute function public.appointments_delete_guard();
