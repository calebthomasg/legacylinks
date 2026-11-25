-- A thread-scoped refresh signal. Session IDs, activity windows, and identities
-- stay in the private activity table and are never sent over Realtime.
create table public.chat_typing_changes (
  thread_id uuid primary key references public.chat_threads(id) on delete cascade,
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.chat_typing_changes enable row level security;
revoke all on public.chat_typing_changes from public, anon, authenticated;
grant select on public.chat_typing_changes to authenticated;
create policy "Conversation members receive typing changes" on public.chat_typing_changes
  for select to authenticated using (public.is_chat_thread_member(thread_id));
alter publication supabase_realtime add table public.chat_typing_changes;

create or replace function public.set_chat_activity(
  activity_session uuid, action text, typing_thread uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_time_at timestamptz := clock_timestamp();
begin
  if actor is null or activity_session is null then return; end if;
  if action = 'leave' then
    delete from public.chat_activity_sessions s where s.user_id = actor and s.session_id = activity_session;
    return;
  end if;
  if action = 'stop' then
    update public.chat_activity_sessions s set typing_thread_id = null, typing_until = null
    where s.user_id = actor and s.session_id = activity_session and s.typing_thread_id = typing_thread;
    return;
  end if;
  if action = 'typing' and (typing_thread is null or not public.is_chat_thread_member(typing_thread)) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  if action = 'typing' and exists (select 1 from public.chat_privacy p where p.user_id = actor and not p.show_typing) then return; end if;
  if action not in ('heartbeat', 'typing') then return; end if;
  delete from public.chat_activity_sessions s where s.user_id = actor and s.online_until < current_time_at;
  insert into public.chat_activity_sessions as s
    (user_id, session_id, online_until, typing_thread_id, typing_until)
  values (actor, activity_session, current_time_at + interval '45 seconds',
    case when action = 'typing' then typing_thread end,
    case when action = 'typing' then current_time_at + interval '6 seconds' end)
  on conflict (user_id, session_id) do update set
    online_until = excluded.online_until,
    typing_thread_id = case when action = 'typing' then excluded.typing_thread_id else s.typing_thread_id end,
    typing_until = case when action = 'typing' then excluded.typing_until else s.typing_until end;
end;
$$;

create function public.notify_chat_typing_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_thread uuid;
  next_thread uuid;
  previous_until timestamptz;
  next_until timestamptz;
begin
  if tg_op <> 'INSERT' then
    previous_thread := old.typing_thread_id;
    previous_until := old.typing_until;
  end if;
  if tg_op <> 'DELETE' then
    next_thread := new.typing_thread_id;
    next_until := new.typing_until;
  end if;
  if previous_thread is not distinct from next_thread and previous_until is not distinct from next_until then return null; end if;
  insert into public.chat_typing_changes(thread_id)
    select distinct candidate from unnest(array[
      case when previous_until > statement_timestamp() then previous_thread end,
      next_thread
    ]) as changes(candidate)
    join public.chat_threads t on t.id = candidate and t.deleted_at is null
    order by candidate
  on conflict(thread_id) do update set changed_at = clock_timestamp();
  return null;
end;
$$;
revoke all on function public.notify_chat_typing_change() from public, anon, authenticated;
create trigger notify_chat_typing_change after insert or update or delete on public.chat_activity_sessions
  for each row execute function public.notify_chat_typing_change();
