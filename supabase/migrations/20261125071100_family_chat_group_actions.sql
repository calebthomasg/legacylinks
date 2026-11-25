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
    and t.deleted_at is null
  for update;
  if not found or not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Only active group members can add people' using errcode = '42501';
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

drop policy "Family Chat object uploads" on storage.objects;
create policy "Family Chat object uploads" on storage.objects for insert to authenticated with check (
  bucket_id = 'family-chat-private'
  and split_part(name,'/',3) = (select auth.uid())::text
  and case when pg_input_is_valid(split_part(name,'/',1),'uuid') then (
    public.is_chat_thread_member(split_part(name,'/',1)::uuid)
    and (
      split_part(name,'/',2) = 'file'
      or (split_part(name,'/',2) = 'group' and exists (
        select 1 from public.chat_threads thread where thread.id = split_part(name,'/',1)::uuid
          and thread.thread_type = 'group' and thread.deleted_at is null
      ))
    )
  ) else false end
);

create function public.save_chat_group_photo(thread_uuid uuid, image_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  previous_path text;
  actor uuid := auth.uid();
begin
  select t.group_image_path into previous_path from public.chat_threads t
  where t.id = thread_uuid and t.thread_type = 'group' and t.deleted_at is null
  for update;
  if not found or not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Group unavailable' using errcode = '42501';
  end if;
  if image_path is null or image_path not like thread_uuid::text || '/group/' || actor::text || '/%'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'family-chat-private'
      and o.name = image_path and o.metadata->>'mimetype' = 'image/jpeg')
  then raise exception 'Invalid group photo' using errcode = '22023'; end if;
  update public.chat_threads set group_image_path = image_path where id = thread_uuid;
  return previous_path;
end;
$$;
revoke all on function public.save_chat_group_photo(uuid,text) from public, anon;
grant execute on function public.save_chat_group_photo(uuid,text) to authenticated;
