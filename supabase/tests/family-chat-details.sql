-- Run on a test project. No fixtures or changes are retained.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  peer_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  group_id uuid;
  text_id uuid := gen_random_uuid();
  file_id uuid := gen_random_uuid();
  file_path text;
  image_path text;
  typing_session uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id, id::text || '@family-chat-test.invalid', '{"first_name":"Test","last_name":"Family"}'
    from unnest(array[owner_id,member_id,peer_id,outsider_id]) users(id);
  insert into public.family_connection_requests(requester_user_id,recipient_user_id,relationship_type,status)
  values (owner_id,member_id,'sibling','accepted'),(owner_id,peer_id,'sibling','accepted');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  set local role authenticated;
  group_id := public.create_chat_thread(array[member_id,peer_id],'Demo group');
  perform public.send_chat_message(group_id,'Find this https://example.com/picnic',text_id);
  perform public.save_chat_pin(group_id,text_id,true);
  perform public.save_chat_nickname(group_id,member_id,'Trail buddy');
  perform public.save_chat_notification_settings(group_id,true,true);
  perform public.report_chat_issue(group_id,'A synthetic composer issue');

  file_path := group_id::text || '/file/' || owner_id::text || '/' || file_id::text;
  image_path := group_id::text || '/group/' || owner_id::text || '/' || gen_random_uuid()::text;
  insert into storage.objects(bucket_id,name,metadata) values
    ('family-chat-private',file_path,'{"mimetype":"image/png","size":100}'),
    ('family-chat-private',image_path,'{"mimetype":"image/jpeg","size":100}');
  perform public.save_chat_group(group_id,'Renamed family group',image_path);
  perform public.send_chat_file(group_id,file_id,file_path,'picnic.png');
  perform public.send_chat_file(group_id,file_id,file_path,'picnic.png');
  if (select count(*) from public.chat_shared_files where message_id=file_id) <> 1 then raise exception 'File retry produced duplicate data'; end if;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  if not exists(select 1 from public.chat_threads where id=group_id and title='Renamed family group') then raise exception 'Renamed group missing'; end if;
  if not exists(select 1 from public.chat_thread_members where thread_id=group_id and user_id=member_id and nickname='Trail buddy' and muted_at is null) then raise exception 'Nickname or private mute failed'; end if;
  if (select count(*) from storage.objects o where o.bucket_id='family-chat-private' and o.name in (file_path,image_path)) <> 2 then raise exception 'Member cannot access posted media'; end if;
  if not exists(select 1 from public.search_chat_messages(group_id,'Find this') where id=text_id) or not exists(select 1 from public.read_chat_links(group_id) where url='https://example.com/picnic') then raise exception 'Search or link discovery failed'; end if;
  if not exists(select 1 from public.read_chat_message_context(group_id,text_id) where id=file_id) then raise exception 'Search context failed'; end if;
  if not exists(select 1 from public.chat_pins where message_id=text_id and unpinned_at is null) then raise exception 'Pin missing'; end if;
  perform public.save_chat_pin(group_id,text_id,false);
  if exists(select 1 from public.chat_pins where message_id=text_id and unpinned_at is null) then raise exception 'Unpin failed'; end if;

  begin
    perform public.save_chat_group(group_id,'An unauthorized change');
    raise exception 'A non-creator changed the group';
  exception when insufficient_privilege then null;
  end;

  perform public.mark_chat_read(group_id,text_id);
  perform public.save_chat_privacy('receipts',true);
  perform public.mark_chat_read(group_id,text_id);
  perform public.set_chat_activity(typing_session,'typing',group_id);
  perform public.save_chat_privacy('typing',false);
  perform public.set_chat_activity(typing_session,'typing',group_id);

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if not exists(select 1 from public.read_chat_receipts(group_id) where user_id=member_id) then raise exception 'Opted-in receipt missing'; end if;
  if exists(select 1 from public.read_chat_activity(group_id) where user_id=member_id and typing) then raise exception 'Typing opt-out leaked'; end if;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  perform public.save_chat_privacy('receipts',false);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if exists(select 1 from public.read_chat_receipts(group_id)) then raise exception 'Receipt opt-out leaked'; end if;

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  if exists(select 1 from public.chat_shared_files where thread_id=group_id)
    or exists(select 1 from public.search_chat_messages(group_id,'Find this'))
    or exists(select 1 from storage.objects o where o.bucket_id='family-chat-private' and o.name in (file_path,image_path))
    or exists(select 1 from public.read_chat_receipts(group_id)) then raise exception 'A non-member could access private data'; end if;
  reset role;
  if not exists(select 1 from public.chat_issue_reports where thread_id=group_id and reporter_id=owner_id and description='A synthetic composer issue') then raise exception 'Issue report missing'; end if;
end;
$$;
rollback;
select 'PASS: group details, search, pins, private attachments, per-user notifications and privacy, and issue reports' as result;
