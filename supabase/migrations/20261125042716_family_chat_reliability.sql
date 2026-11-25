-- The existing chat tables are defined in supabase/family-chat-foundation.sql.
-- Keep existing thread and message IDs, including any historical duplicate direct threads.
create index if not exists chat_messages_active_history_idx
  on public.chat_messages (thread_id, created_at desc, id desc) where deleted_at is null;

create index if not exists chat_thread_members_active_user_idx
  on public.chat_thread_members (user_id, thread_id) where left_at is null;

-- Route writes through the checked functions. Keep the existing member-only read policies.
revoke insert, update, delete on public.chat_threads, public.chat_thread_members,
  public.chat_messages from public, anon, authenticated;

-- Find Family already accepts/declines via recipient-checked RPCs.
-- The chat eligibility check must never rely on client-editable acceptance.
revoke update on public.family_connection_requests from public, anon, authenticated;

create policy "Users can read their own chat membership"
  on public.chat_thread_members for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.chat_connected_user_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct case when r.requester_user_id = auth.uid()
    then r.recipient_user_id else r.requester_user_id end
  from public.family_connection_requests r
  where r.status = 'accepted'
    and auth.uid() in (r.requester_user_id, r.recipient_user_id);
$$;

-- Return only display names, with access limited to connections and people
-- who share a conversation with the caller. The profiles table stays private.
create or replace function public.read_chat_names(user_ids uuid[])
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.first_name::text, p.last_name::text
  from public.profiles p
  where p.id = any(user_ids) and (
    p.id = auth.uid()
    or p.id in (select public.chat_connected_user_ids())
    or exists (
      select 1 from public.chat_thread_members m
      join public.chat_thread_members mine on mine.thread_id = m.thread_id
      join public.chat_threads t on t.id = mine.thread_id and t.deleted_at is null
      where m.user_id = p.id and mine.user_id = auth.uid() and mine.left_at is null
    )
  );
$$;

create or replace function public.create_chat_thread(
  recipient_user_ids uuid[], thread_title text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recipients uuid[];
  thread_uuid uuid;
  title text := nullif(btrim(thread_title), '');
begin
  if actor is null then
    raise exception 'Sign in to start a conversation' using errcode = '28000';
  end if;
  select array_agg(distinct id) into recipients
  from unnest(recipient_user_ids) ids(id) where id <> actor;
  if recipients is null or cardinality(recipients) > 100 or length(title) > 120 then
    raise exception 'Choose between 1 and 100 recipients and a name up to 120 characters' using errcode = '22023';
  end if;
  if exists (
    select unnest(recipients)
    except select public.chat_connected_user_ids()
  ) then
    raise exception 'Recipients must have accepted a family connection' using errcode = '42501';
  end if;

  if cardinality(recipients) = 1 then
    -- Serialize creations for the same unordered pair.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'legacy-chat:' || least(actor, recipients[1])::text || ':' ||
      greatest(actor, recipients[1])::text, 0
    ));
    select t.id into thread_uuid
    from public.chat_threads t
    join public.chat_thread_members a on a.thread_id = t.id and a.user_id = actor and a.left_at is null
    join public.chat_thread_members b on b.thread_id = t.id and b.user_id = recipients[1] and b.left_at is null
    where t.thread_type = 'direct' and t.deleted_at is null
      and 2 = (select count(*) from public.chat_thread_members m where m.thread_id = t.id and m.left_at is null)
    order by t.last_message_at desc nulls last, t.created_at, t.id
    limit 1;
    if found then
      return thread_uuid;
    end if;
  end if;

  if cardinality(recipients) > 1 and title is null then
    select left(string_agg(coalesce(nullif(p.display_name, ''),
        nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        'Family member'), ', ' order by ids.id), 120) into title
    from unnest(recipients) ids(id)
    left join lateral (
      select person.display_name, person.first_name, person.last_name
      from public.people person
      where person.created_by_user_id = actor and person.linked_user_id = ids.id
      order by person.created_at desc, person.id limit 1
    ) p on true;
  end if;

  insert into public.chat_threads (thread_type, title, created_by_user_id)
  values (
    case when cardinality(recipients) = 1 then 'direct' else 'group' end,
    case when cardinality(recipients) > 1 then title end,
    actor
  ) returning id into thread_uuid;

  insert into public.chat_thread_members (thread_id, user_id, person_id, role)
  select thread_uuid, ids.id, person.id, case when ids.id = actor then 'owner' else 'member' end
  from unnest(array_prepend(actor, recipients)) ids(id)
  left join lateral (
    select p.id from public.people p
    where p.created_by_user_id = actor and p.linked_user_id = ids.id
    order by p.created_at desc, p.id limit 1
  ) person on true;

  return thread_uuid;
end;
$$;

create or replace function public.add_chat_group_members(thread_uuid uuid, recipient_user_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recipients uuid[];
begin
  perform 1 from public.chat_threads t
  where t.id = thread_uuid and t.thread_type = 'group'
    and t.created_by_user_id = actor and t.deleted_at is null
  for update;
  if not found or not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Only the active group creator can add members' using errcode = '42501';
  end if;
  select array_agg(distinct id) into recipients
  from unnest(recipient_user_ids) ids(id) where id <> actor;
  if recipients is null or cardinality(recipients) > 100 then
    raise exception 'Choose between 1 and 100 recipients' using errcode = '22023';
  end if;
  if exists (
    select unnest(recipients)
    except select public.chat_connected_user_ids()
  ) then
    raise exception 'Recipients must have accepted a family connection' using errcode = '42501';
  end if;

  insert into public.chat_thread_members (thread_id, user_id, person_id)
  select thread_uuid, ids.id, (
    select p.id from public.people p where p.created_by_user_id = actor and p.linked_user_id = ids.id
    order by p.created_at desc, p.id limit 1
  )
  from unnest(recipients) ids(id)
  on conflict (thread_id, user_id) do update set left_at = null
    where chat_thread_members.left_at is not null;
end;
$$;

create or replace function public.leave_chat_group(thread_uuid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.chat_threads t
  where t.id = thread_uuid and t.thread_type = 'group' and t.deleted_at is null
  for update;
  if not found then
    raise exception 'Group unavailable' using errcode = '42501';
  end if;
  update public.chat_thread_members m set left_at = now()
  where m.thread_id = thread_uuid and m.user_id = auth.uid() and m.left_at is null;
end;
$$;

create or replace function public.send_chat_message(
  thread_uuid uuid, message_body text, client_message_id uuid
)
returns public.chat_messages
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cleaned_body text := btrim(message_body);
  saved public.chat_messages;
begin
  if client_message_id is null or cleaned_body is null or length(cleaned_body) not between 1 and 4000 then
    raise exception 'Write a message between 1 and 4000 characters' using errcode = '22023';
  end if;
  perform 1 from public.chat_threads t where t.id = thread_uuid and t.deleted_at is null for update;
  if not found or not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  insert into public.chat_messages (id, thread_id, sender_user_id, body, created_at)
  values (client_message_id, thread_uuid, actor, cleaned_body, clock_timestamp())
  on conflict (id) do nothing
  returning * into saved;

  if not found then
    select * into saved from public.chat_messages m
    where m.id = client_message_id and m.thread_id = thread_uuid and m.sender_user_id = actor
      and m.body = cleaned_body and m.deleted_at is null;
    if not found then
      raise exception 'Message could not be retried' using errcode = '22023';
    end if;
    return saved;
  end if;

  update public.chat_threads t
  set last_message_at = greatest(t.last_message_at, saved.created_at)
  where t.id = thread_uuid;
  return saved;
end;
$$;

create or replace function public.send_chat_message(thread_uuid uuid, message_body text)
returns public.chat_messages
language sql security invoker set search_path = ''
as $$
  select public.send_chat_message(thread_uuid, message_body, gen_random_uuid());
$$;

create or replace function public.read_chat_history(
  thread_uuid uuid, before_created_at timestamptz default null, before_id uuid default null
)
returns table (id uuid, thread_id uuid, sender_user_id uuid, body text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select m.id, m.thread_id, m.sender_user_id, m.body, m.created_at
  from public.chat_messages m
  where m.thread_id = thread_uuid and m.deleted_at is null
    and (before_created_at is null or (m.created_at, m.id) < (before_created_at, before_id))
  order by m.created_at desc, m.id desc
  limit 51;
$$;

create or replace function public.read_chat_previews(thread_ids uuid[])
returns table (thread_id uuid, body text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select m.thread_id, m.body, m.created_at from public.chat_threads t
  cross join lateral (
    select msg.thread_id, msg.body, msg.created_at from public.chat_messages msg
    where msg.thread_id = t.id and msg.deleted_at is null
    order by msg.created_at desc, msg.id desc limit 1
  ) m
  where t.id = any(thread_ids);
$$;

-- One short-lived status row per device/tab. Message text is never sent here.
create table public.chat_activity_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  online_until timestamptz not null,
  typing_thread_id uuid references public.chat_threads(id) on delete cascade,
  typing_until timestamptz,
  primary key (user_id, session_id)
);
alter table public.chat_activity_sessions enable row level security;
revoke all on public.chat_activity_sessions from public, anon, authenticated;
create index chat_activity_expiry_idx on public.chat_activity_sessions (online_until);

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

create or replace function public.read_chat_activity(selected_thread uuid default null)
returns table (user_id uuid, typing boolean)
language sql stable security definer set search_path = ''
as $$
  select s.user_id, bool_or(coalesce(
    s.typing_until > now() and s.typing_thread_id = selected_thread and member.thread_id = selected_thread,
    false
  ))
  from public.chat_thread_members mine
  join public.chat_threads t on t.id = mine.thread_id and t.deleted_at is null
  join public.chat_thread_members member on member.thread_id = t.id and member.left_at is null
  join public.chat_activity_sessions s on s.user_id = member.user_id and s.online_until > now()
  where mine.user_id = auth.uid() and mine.left_at is null and member.user_id <> auth.uid()
  group by s.user_id;
$$;

revoke all on function public.chat_connected_user_ids(), public.read_chat_names(uuid[]), public.create_chat_thread(uuid[], text),
  public.add_chat_group_members(uuid, uuid[]), public.leave_chat_group(uuid),
  public.send_chat_message(uuid, text), public.send_chat_message(uuid, text, uuid),
  public.read_chat_history(uuid, timestamptz, uuid), public.read_chat_previews(uuid[]),
  public.set_chat_activity(uuid, text, uuid), public.read_chat_activity(uuid)
  from public, anon;
grant execute on function public.chat_connected_user_ids(), public.read_chat_names(uuid[]), public.create_chat_thread(uuid[], text),
  public.add_chat_group_members(uuid, uuid[]), public.leave_chat_group(uuid),
  public.send_chat_message(uuid, text), public.send_chat_message(uuid, text, uuid),
  public.read_chat_history(uuid, timestamptz, uuid), public.read_chat_previews(uuid[]),
  public.set_chat_activity(uuid, text, uuid), public.read_chat_activity(uuid)
  to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'chat_thread_members'
  ) then
    alter publication supabase_realtime add table public.chat_thread_members;
  end if;
end;
$$;
