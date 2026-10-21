-- Recordatorios por WhatsApp: reglas, historial de envíos y estado de la campana.

alter table public.settings
  -- Un recordatorio de "toca baño" vuelve a salir si pasan estos días sin que el cliente responda.
  add column reminder_repeat_days integer not null default 7 check (reminder_repeat_days >= 1),
  -- Reactivación: días de retraso, contados desde la fecha en que le tocaba el baño.
  add column reactivation_first integer not null default 30 check (reactivation_first >= 1),
  add column reactivation_second integer not null default 60 check (reactivation_second >= 1),
  add constraint reactivation_order check (reactivation_second > reactivation_first);

grant update (reminder_repeat_days, reactivation_first, reactivation_second) on public.settings to authenticated;

-- Constancia de cuándo el cliente autorizó recibir mensajes.
alter table public.owners add column consent_at timestamptz;

-- Qué recordatorios ya vio cada usuario (la campana titila mientras haya alguno nuevo).
alter table public.profiles add column reminders_seen_keys text[] not null default '{}';

-- Historial de recordatorios enviados. No se edita ni se borra; solo se puede deshacer un envío reciente.
create table public.reminder_log (
  id             uuid primary key default gen_random_uuid(),
  base_key       text not null,
  type           text not null check (type in ('cita', 'bano', 'cumple', 'reactiva')),
  pet_id         uuid references public.pets (id) on delete set null,
  owner_id       uuid references public.owners (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  whatsapp       text not null default '',
  message        text not null default '',
  sent_at        timestamptz not null default now(),
  sent_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  sent_by_name   text not null default '',
  undone_at      timestamptz,
  undone_by      uuid references public.profiles (id) on delete set null
);
create index reminder_log_key_idx on public.reminder_log (base_key);
create index reminder_log_sent_idx on public.reminder_log (sent_at desc);
create index reminder_log_pet_idx on public.reminder_log (pet_id);

alter table public.reminder_log enable row level security;
create policy reminder_log_select on public.reminder_log for select to authenticated using (public.is_active_user());
create policy reminder_log_insert on public.reminder_log for insert to authenticated
  with check (public.is_active_user() and sent_by = auth.uid());

-- Deshacer un envío marcado por error (solo las últimas 24 horas).
create function public.undo_reminder(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_user() then
    raise exception 'No tienes permiso para esta acción.';
  end if;
  update public.reminder_log
     set undone_at = now(), undone_by = auth.uid()
   where id = p_id and undone_at is null and sent_at > now() - interval '1 day';
  if not found then
    raise exception 'Solo se puede deshacer un envío de las últimas 24 horas.';
  end if;
end $$;

-- Cada usuario anota qué recordatorios ya vio (no puede tocar nada más de su perfil).
create function public.mark_reminders_seen(p_keys text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set reminders_seen_keys = coalesce(p_keys, '{}') where id = auth.uid();
end $$;

-- Último baño y número de baños de cada mascota.
create function public.pet_visit_stats() returns table (pet_id uuid, last_visit date, baths integer)
language sql stable set search_path = '' as $$
  select pet_id, max(visit_date), count(*)::integer from public.visits where status = 'cobrado' group by pet_id
$$;

revoke execute on function public.undo_reminder(uuid), public.mark_reminders_seen(text[]), public.pet_visit_stats() from public, anon;
grant execute on function public.undo_reminder(uuid), public.mark_reminders_seen(text[]), public.pet_visit_stats() to authenticated;
