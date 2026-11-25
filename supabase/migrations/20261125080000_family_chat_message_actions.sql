alter table public.chat_messages
  add column reply_to_id uuid references public.chat_messages(id) on delete set null,
  add column removed_for_everyone boolean not null default false,
  add constraint chat_messages_removed_body_check check (
    not removed_for_everyone or (deleted_at is not null and body = 'Message removed' and reply_to_id is null)
  );
create index chat_message_replies_idx on public.chat_messages(reply_to_id) where reply_to_id is not null;

-- Legacy deletions stay hidden. New removals replace the body before becoming visible.
drop policy "Members can view active chat messages" on public.chat_messages;
create policy "Members can read chat timeline" on public.chat_messages for select to authenticated
  using ((deleted_at is null or removed_for_everyone) and public.is_chat_thread_member(thread_id));

create function public.read_chat_timeline(thread_uuid uuid, before_created_at timestamptz default null, before_id uuid default null)
returns setof public.chat_messages language sql stable security invoker set search_path = '' as $$
  select m.* from public.chat_messages m
  where m.thread_id = thread_uuid and (m.deleted_at is null or m.removed_for_everyone)
    and (before_created_at is null or (m.created_at,m.id) < (before_created_at,before_id))
  order by m.created_at desc,m.id desc limit 51;
$$;

create table public.chat_message_reactions (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text check (reaction in ('heart','laugh','wow','sad','angry','like')),
  primary key (message_id,user_id)
);
alter table public.chat_message_reactions enable row level security;
revoke all on public.chat_message_reactions from public, anon, authenticated;
grant select on public.chat_message_reactions to authenticated;
create policy "Chat members read reactions" on public.chat_message_reactions for select to authenticated
  using (public.is_chat_thread_member(thread_id));
alter publication supabase_realtime add table public.chat_message_reactions;

create function public.set_chat_reaction(thread_uuid uuid, message_uuid uuid, reaction_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Message unavailable' using errcode = '42501';
  end if;
  perform 1 from public.chat_messages m where m.id = message_uuid and m.thread_id = thread_uuid and m.deleted_at is null
  for update;
  if not found then raise exception 'Message unavailable' using errcode = '42501'; end if;
  insert into public.chat_message_reactions(thread_id,message_id,user_id,reaction)
    values(thread_uuid,message_uuid,auth.uid(),reaction_key)
    on conflict(message_id,user_id) do update set reaction = excluded.reaction;
end;
$$;

create function public.remove_own_chat_message(thread_uuid uuid, message_uuid uuid)
returns public.chat_messages language plpgsql security definer set search_path = '' as $$
declare saved public.chat_messages;
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Message unavailable' using errcode = '42501';
  end if;
  update public.chat_messages m
    set body = 'Message removed', deleted_at = coalesce(m.deleted_at,now()), removed_for_everyone = true, reply_to_id = null
    where m.id = message_uuid and m.thread_id = thread_uuid and m.sender_user_id = auth.uid()
      and (m.deleted_at is null or m.removed_for_everyone)
    returning m.* into saved;
  if not found then raise exception 'Only the sender can remove their message' using errcode = '42501'; end if;
  update public.chat_pins set unpinned_at = now() where message_id = saved.id and unpinned_at is null;
  update public.chat_message_reactions set reaction = null where message_id = saved.id and reaction is not null;
  return saved;
end;
$$;

drop policy "Chat members can read shared files" on public.chat_shared_files;
create policy "Chat members read active shared files" on public.chat_shared_files for select to authenticated
  using (public.is_chat_thread_member(thread_id)
    and exists(select 1 from public.chat_messages m where m.id = message_id and m.deleted_at is null));

-- Keep the association private even for its sender after removal. Existing signed URLs expire on their normal schedule.
create function public.is_removed_chat_attachment(thread_uuid uuid, object_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_chat_thread_member(thread_uuid) and exists (
    select 1 from public.chat_shared_files f join public.chat_messages m on m.id = f.message_id
    where f.thread_id = thread_uuid and f.object_path = is_removed_chat_attachment.object_path and m.deleted_at is not null
  );
$$;
revoke all on function public.is_removed_chat_attachment(uuid,text) from public, anon;
grant execute on function public.is_removed_chat_attachment(uuid,text) to authenticated;
drop policy "Family Chat object reads" on storage.objects;
create policy "Family Chat object reads" on storage.objects for select to authenticated using (
  bucket_id = 'family-chat-private' and case when pg_input_is_valid(split_part(name,'/',1),'uuid') then
    public.is_chat_thread_member(split_part(name,'/',1)::uuid)
    and not public.is_removed_chat_attachment(split_part(name,'/',1)::uuid,name)
    and (
      split_part(name,'/',3) = (select auth.uid())::text
      or exists(select 1 from public.chat_shared_files f where f.object_path = name)
      or exists(select 1 from public.chat_threads t where t.group_image_path = name)
    )
  else false end
);

create function public.send_chat_message(
  thread_uuid uuid, message_body text, client_message_id uuid, reply_message_id uuid
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

  select * into saved from public.chat_messages m where m.id = client_message_id;
  if found then
    if saved.thread_id = thread_uuid and saved.sender_user_id = actor and saved.body = cleaned_body
      and saved.deleted_at is null and saved.reply_to_id is not distinct from reply_message_id then return saved; end if;
    raise exception 'Message could not be retried' using errcode = '22023';
  end if;
  if reply_message_id is not null then
    perform 1 from public.chat_messages m where m.id = reply_message_id and m.thread_id = thread_uuid and m.deleted_at is null
    for update;
    if not found then raise exception 'Reply target unavailable' using errcode = '22023'; end if;
  end if;
  insert into public.chat_messages (id, thread_id, sender_user_id, body, created_at, reply_to_id)
  values (client_message_id, thread_uuid, actor, cleaned_body, clock_timestamp(), reply_message_id)
  on conflict (id) do nothing
  returning * into saved;

  if not found then raise exception 'Message could not be retried' using errcode = '22023'; end if;

  update public.chat_threads t
  set last_message_at = greatest(t.last_message_at, saved.created_at)
  where t.id = thread_uuid;
  return saved;
end;
$$;

create function public.send_chat_file(thread_uuid uuid, client_message_id uuid, file_path text, display_name text, caption text, reply_message_id uuid)
returns public.chat_messages language plpgsql security definer set search_path = '' as $$
declare
  mime text;
  saved public.chat_messages;
begin
  if not public.is_chat_thread_member(thread_uuid)
    or file_path not like thread_uuid::text || '/file/' || auth.uid()::text || '/%' then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  select o.metadata->>'mimetype' into mime from storage.objects o
    where o.name = file_path and o.bucket_id = 'family-chat-private';
  if mime is null or display_name is null or length(btrim(display_name)) not between 1 and 240 then
    raise exception 'File unavailable' using errcode = '22023';
  end if;
  saved := public.send_chat_message(thread_uuid, coalesce(nullif(btrim(caption),''),'Shared ' || btrim(display_name)),client_message_id,reply_message_id);
  insert into public.chat_shared_files(message_id,thread_id,object_path,file_name,mime_type)
    values(saved.id,thread_uuid,file_path,btrim(display_name),mime)
  on conflict(message_id) do nothing;
  if not exists(select 1 from public.chat_shared_files f where f.message_id = saved.id and f.object_path = file_path) then
    raise exception 'Message already has a different file' using errcode = '22023';
  end if;
  return saved;
end;
$$;

create or replace function public.save_chat_pin(thread_uuid uuid, message_uuid uuid, pinned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Message unavailable' using errcode = '42501';
  end if;
  perform 1 from public.chat_messages m where m.id = message_uuid and m.thread_id = thread_uuid and m.deleted_at is null
  for update;
  if not found then raise exception 'Message unavailable' using errcode = '42501'; end if;
  if pinned then
    insert into public.chat_pins(thread_id,message_id) values(thread_uuid,message_uuid)
    on conflict(thread_id,message_id) do update set pinned_at = now(), unpinned_at = null
    where chat_pins.unpinned_at is not null;
  else
    update public.chat_pins p set unpinned_at = now()
      where p.thread_id = thread_uuid and p.message_id = message_uuid and p.unpinned_at is null;
  end if;
end;
$$;

create or replace function public.read_chat_previews(thread_ids uuid[])
returns table (thread_id uuid, body text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select m.thread_id, m.body, m.created_at from public.chat_threads t
  cross join lateral (
    select msg.thread_id, msg.body, msg.created_at from public.chat_messages msg
    where msg.thread_id = t.id and (msg.deleted_at is null or msg.removed_for_everyone)
    order by msg.created_at desc, msg.id desc limit 1
  ) m
  where t.id = any(thread_ids);
$$;

revoke all on function public.read_chat_timeline(uuid,timestamptz,uuid), public.set_chat_reaction(uuid,uuid,text),
  public.remove_own_chat_message(uuid,uuid), public.send_chat_message(uuid,text,uuid,uuid),
  public.send_chat_file(uuid,uuid,text,text,text,uuid) from public, anon;
grant execute on function public.read_chat_timeline(uuid,timestamptz,uuid), public.set_chat_reaction(uuid,uuid,text),
  public.remove_own_chat_message(uuid,uuid), public.send_chat_message(uuid,text,uuid,uuid),
  public.send_chat_file(uuid,uuid,text,text,text,uuid) to authenticated;
