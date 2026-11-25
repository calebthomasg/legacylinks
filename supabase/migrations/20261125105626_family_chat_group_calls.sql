create table public.chat_group_call_slots (
  thread_id uuid primary key references public.chat_threads(id) on delete cascade,
  call_id uuid not null unique,
  caller_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('audio','video')),
  reserved_at timestamptz not null,
  expires_at timestamptz not null
);

alter table public.chat_group_call_slots enable row level security;
revoke all on public.chat_group_call_slots from anon, authenticated;
grant select on public.chat_group_call_slots to authenticated;

create policy "Current group members can read their call slot"
  on public.chat_group_call_slots for select to authenticated
  using (public.is_chat_thread_member(thread_id));

create function public.reserve_chat_group_call(thread_uuid uuid, requested_mode text)
returns table(call_id uuid, caller_id uuid, mode text, reserved_at timestamptz, expires_at timestamptz, claimed boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  slot public.chat_group_call_slots;
  next_id uuid := gen_random_uuid();
  reserved timestamptz := clock_timestamp();
begin
  if actor is null or requested_mode not in ('audio', 'video') or requested_mode is null
    or not public.is_chat_thread_member(thread_uuid)
    or not exists (select 1 from public.chat_threads t where t.id = thread_uuid and t.thread_type = 'group' and t.deleted_at is null) then
    raise exception 'Group call is unavailable' using errcode = '42501';
  end if;

  insert into public.chat_group_call_slots as current_slot
    (thread_id, call_id, caller_id, mode, reserved_at, expires_at)
  values (thread_uuid, next_id, actor, requested_mode, reserved, reserved + interval '45 seconds')
  on conflict (thread_id) do update set
    call_id = excluded.call_id, caller_id = excluded.caller_id, mode = excluded.mode,
    reserved_at = excluded.reserved_at, expires_at = excluded.expires_at
  where current_slot.expires_at <= reserved
  returning * into slot;

  if not found then
    select s.* into strict slot from public.chat_group_call_slots s where s.thread_id = thread_uuid;
  end if;

  return query select slot.call_id, slot.caller_id, slot.mode, slot.reserved_at, slot.expires_at, slot.call_id = next_id;
end;
$$;

create function public.refresh_chat_group_call_slot(thread_uuid uuid, active_call_uuid uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.chat_group_call_slots as slot
  set expires_at = clock_timestamp() + interval '45 seconds'
  where slot.thread_id = thread_uuid and slot.call_id = active_call_uuid
    and auth.uid() is not null and public.is_chat_thread_member(thread_uuid);
$$;

revoke all on function public.reserve_chat_group_call(uuid, text), public.refresh_chat_group_call_slot(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_chat_group_call(uuid, text), public.refresh_chat_group_call_slot(uuid, uuid)
  to authenticated;
