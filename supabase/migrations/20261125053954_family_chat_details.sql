alter table public.chat_threads add column group_image_path text;
alter table public.chat_thread_members add column nickname text;
alter table public.chat_thread_members add column play_sounds boolean not null default false;

create table public.chat_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_typing boolean not null default true,
  show_read_receipts boolean not null default false
);
create table public.chat_read_positions (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_through timestamptz not null,
  primary key (thread_id, user_id)
);
create table public.chat_pins (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  unpinned_at timestamptz,
  primary key (thread_id, message_id)
);
create table public.chat_shared_files (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  object_path text not null unique,
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);
create index chat_shared_files_thread_time_idx on public.chat_shared_files(thread_id, created_at desc);
create table public.chat_issue_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.chat_threads(id) on delete set null,
  description text not null check (length(description) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.chat_privacy enable row level security;
alter table public.chat_read_positions enable row level security;
alter table public.chat_pins enable row level security;
alter table public.chat_shared_files enable row level security;
alter table public.chat_issue_reports enable row level security;

revoke all on public.chat_privacy, public.chat_read_positions, public.chat_pins,
  public.chat_shared_files, public.chat_issue_reports from public, anon, authenticated;
grant select on public.chat_privacy, public.chat_pins, public.chat_shared_files to authenticated;
create policy "Chat users can read their privacy settings" on public.chat_privacy for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Chat members can read pins" on public.chat_pins for select to authenticated
  using (public.is_chat_thread_member(thread_id));
create policy "Chat members can read shared files" on public.chat_shared_files for select to authenticated
  using (public.is_chat_thread_member(thread_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('family-chat-private','family-chat-private',false,20971520,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

create policy "Family Chat object uploads" on storage.objects for insert to authenticated with check (
  bucket_id = 'family-chat-private'
  and split_part(name,'/',3) = (select auth.uid())::text
  and case when pg_input_is_valid(split_part(name,'/',1),'uuid') then (
    (split_part(name,'/',2) = 'file' and public.is_chat_thread_member(split_part(name,'/',1)::uuid))
    or (split_part(name,'/',2) = 'group' and exists (
      select 1 from public.chat_threads thread where thread.id = split_part(name,'/',1)::uuid
        and thread.thread_type = 'group' and thread.created_by_user_id = (select auth.uid())
    ))
  ) else false end
);
create policy "Family Chat object reads" on storage.objects for select to authenticated using (
  bucket_id = 'family-chat-private' and case when pg_input_is_valid(split_part(name,'/',1),'uuid') then
    public.is_chat_thread_member(split_part(name,'/',1)::uuid) and (
      split_part(name,'/',3) = (select auth.uid())::text
      or exists(select 1 from public.chat_shared_files f where f.object_path = name)
      or exists(select 1 from public.chat_threads t where t.group_image_path = name)
    )
  else false end
);
create policy "Family Chat cleanup of unused uploads" on storage.objects for delete to authenticated using (
  bucket_id = 'family-chat-private' and split_part(name,'/',3) = (select auth.uid())::text
  and case when pg_input_is_valid(split_part(name,'/',1),'uuid') then
    public.is_chat_thread_member(split_part(name,'/',1)::uuid)
  else false end
  and not exists(select 1 from public.chat_shared_files f where f.object_path = name)
  and not exists(select 1 from public.chat_threads t where t.group_image_path = name)
);

create function public.save_chat_group(thread_uuid uuid, group_name text, image_path text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid)
    or not exists (select 1 from public.chat_threads t where t.id = thread_uuid
      and t.thread_type = 'group' and t.created_by_user_id = auth.uid()) then
    raise exception 'Only the group creator can update these details' using errcode = '42501';
  end if;
  if group_name is null or length(btrim(group_name)) not between 1 and 120 then
    raise exception 'Enter a group name with 1 to 120 characters' using errcode = '22023';
  end if;
  if image_path is not null and (
    image_path not like thread_uuid::text || '/group/' || auth.uid()::text || '/%'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'family-chat-private'
      and o.name = image_path and o.metadata->>'mimetype' like 'image/%')
  ) then raise exception 'Invalid group image' using errcode = '22023'; end if;
  update public.chat_threads set title = btrim(group_name),
    group_image_path = coalesce(image_path, group_image_path) where id = thread_uuid;
end;
$$;

create function public.save_chat_nickname(thread_uuid uuid, member_uuid uuid, new_nickname text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  if length(btrim(new_nickname)) > 40 then raise exception 'Use 40 characters or fewer' using errcode = '22023'; end if;
  update public.chat_thread_members m set nickname = nullif(btrim(new_nickname), '')
  where m.thread_id = thread_uuid and m.user_id = member_uuid and m.left_at is null;
  if not found then raise exception 'Member unavailable' using errcode = '42501'; end if;
end;
$$;

create function public.save_chat_notification_settings(thread_uuid uuid, mute_chat boolean, sounds boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  update public.chat_thread_members m set muted_at = case when mute_chat then coalesce(m.muted_at, now()) end,
    play_sounds = coalesce(sounds,false)
  where m.thread_id = thread_uuid and m.user_id = auth.uid() and m.left_at is null;
end;
$$;

create function public.save_chat_privacy(setting text, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or enabled is null or setting is null or setting not in ('typing','receipts') then
    raise exception 'Invalid privacy setting' using errcode = '22023';
  end if;
  insert into public.chat_privacy(user_id, show_typing, show_read_receipts)
  values(actor, case when setting = 'typing' then enabled else true end,
    case when setting = 'receipts' then enabled else false end)
  on conflict(user_id) do update set
    show_typing = case when setting = 'typing' then enabled else chat_privacy.show_typing end,
    show_read_receipts = case when setting = 'receipts' then enabled else chat_privacy.show_read_receipts end;
  if not enabled and setting = 'typing' then
    update public.chat_activity_sessions set typing_until = null, typing_thread_id = null where user_id = actor;
  elsif not enabled and setting = 'receipts' then
    delete from public.chat_read_positions where user_id = actor;
  end if;
end;
$$;

create or replace function public.read_chat_activity(selected_thread uuid default null)
returns table(user_id uuid, typing boolean) language sql stable security definer set search_path = '' as $$
  select s.user_id, bool_or(coalesce(
    s.typing_until > now() and s.typing_thread_id = selected_thread and member.thread_id = selected_thread
    and coalesce(p.show_typing,true), false))
  from public.chat_thread_members mine
  join public.chat_threads t on t.id = mine.thread_id and t.deleted_at is null
  join public.chat_thread_members member on member.thread_id = t.id and member.left_at is null
  join public.chat_activity_sessions s on s.user_id = member.user_id and s.online_until > now()
  left join public.chat_privacy p on p.user_id = s.user_id
  where mine.user_id = auth.uid() and mine.left_at is null and member.user_id <> auth.uid()
  group by s.user_id;
$$;

create function public.mark_chat_read(thread_uuid uuid, message_uuid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then return; end if;
  insert into public.chat_read_positions(thread_id,user_id,read_through)
  select thread_uuid, p.user_id, m.created_at from public.chat_messages m
  join public.chat_privacy p on p.user_id = auth.uid() and p.show_read_receipts
  where m.id = message_uuid and m.thread_id = thread_uuid and m.deleted_at is null
  on conflict(thread_id,user_id) do update set read_through = excluded.read_through
  where chat_read_positions.read_through < excluded.read_through;
end;
$$;

create function public.read_chat_receipts(thread_uuid uuid)
returns table(user_id uuid,read_through timestamptz) language sql stable security definer set search_path = '' as $$
  select r.user_id,r.read_through from public.chat_read_positions r
  join public.chat_privacy p on p.user_id = r.user_id and p.show_read_receipts
  join public.chat_thread_members m on m.thread_id = r.thread_id and m.user_id = r.user_id and m.left_at is null
  where r.thread_id = thread_uuid and r.user_id <> auth.uid() and public.is_chat_thread_member(thread_uuid);
$$;

create function public.save_chat_pin(thread_uuid uuid, message_uuid uuid, pinned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) or not exists (
    select 1 from public.chat_messages m where m.id = message_uuid and m.thread_id = thread_uuid and m.deleted_at is null
  ) then raise exception 'Message unavailable' using errcode = '42501'; end if;
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

create function public.search_chat_messages(thread_uuid uuid, search_text text, page_offset integer default 0)
returns setof public.chat_messages language sql stable security invoker set search_path = '' as $$
  select m.* from public.chat_messages m
  where m.thread_id = thread_uuid and m.deleted_at is null
    and length(btrim(search_text)) between 2 and 120
    and strpos(lower(m.body), lower(btrim(search_text))) > 0
  order by m.created_at desc,m.id desc limit 40 offset greatest(page_offset,0);
$$;

create function public.read_chat_message_context(thread_uuid uuid, message_uuid uuid)
returns setof public.chat_messages language sql stable security invoker set search_path = '' as $$
  with target as (select id,created_at from public.chat_messages
    where id = message_uuid and thread_id = thread_uuid and deleted_at is null)
  (select m.* from public.chat_messages m cross join target t
    where m.thread_id = thread_uuid and m.deleted_at is null and (m.created_at,m.id) <= (t.created_at,t.id)
    order by m.created_at desc,m.id desc limit 16)
  union all
  (select m.* from public.chat_messages m cross join target t
    where m.thread_id = thread_uuid and m.deleted_at is null and (m.created_at,m.id) > (t.created_at,t.id)
    order by m.created_at,m.id limit 12);
$$;

create function public.read_chat_links(thread_uuid uuid,page_offset integer default 0)
returns table(message_id uuid,url text) language sql stable security invoker set search_path = '' as $$
  select m.id, (link.matches)[1]
  from public.chat_messages m
  cross join lateral regexp_matches(m.body, '(https?://[^[:space:]<>"'']+)', 'gi') link(matches)
  where m.thread_id = thread_uuid and m.deleted_at is null
  order by m.created_at desc,m.id desc limit 60 offset greatest(page_offset,0);
$$;

create function public.send_chat_file(thread_uuid uuid, client_message_id uuid, file_path text, display_name text, caption text default null)
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
  saved := public.send_chat_message(thread_uuid, coalesce(nullif(btrim(caption),''),'Shared ' || btrim(display_name)),client_message_id);
  insert into public.chat_shared_files(message_id,thread_id,object_path,file_name,mime_type)
    values(saved.id,thread_uuid,file_path,btrim(display_name),mime)
  on conflict(message_id) do nothing;
  if not exists(select 1 from public.chat_shared_files f where f.message_id = saved.id and f.object_path = file_path) then
    raise exception 'Message already has a different file' using errcode = '22023';
  end if;
  return saved;
end;
$$;

create function public.report_chat_issue(thread_uuid uuid, issue_description text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  insert into public.chat_issue_reports(reporter_id,thread_id,description)
  values(auth.uid(),thread_uuid,btrim(issue_description));
end;
$$;

revoke all on function public.save_chat_group(uuid,text,text),public.save_chat_nickname(uuid,uuid,text),
  public.save_chat_notification_settings(uuid,boolean,boolean),public.save_chat_privacy(text,boolean),
  public.mark_chat_read(uuid,uuid),public.read_chat_receipts(uuid),public.save_chat_pin(uuid,uuid,boolean),
  public.search_chat_messages(uuid,text,integer),public.read_chat_message_context(uuid,uuid),
  public.read_chat_links(uuid,integer),public.send_chat_file(uuid,uuid,text,text,text),
  public.report_chat_issue(uuid,text) from public, anon;
grant execute on function public.save_chat_group(uuid,text,text),public.save_chat_nickname(uuid,uuid,text),
  public.save_chat_notification_settings(uuid,boolean,boolean),public.save_chat_privacy(text,boolean),
  public.mark_chat_read(uuid,uuid),public.read_chat_receipts(uuid),public.save_chat_pin(uuid,uuid,boolean),
  public.search_chat_messages(uuid,text,integer),public.read_chat_message_context(uuid,uuid),
  public.read_chat_links(uuid,integer),public.send_chat_file(uuid,uuid,text,text,text),
  public.report_chat_issue(uuid,text) to authenticated;

alter publication supabase_realtime add table public.chat_pins, public.chat_shared_files, public.chat_threads;
