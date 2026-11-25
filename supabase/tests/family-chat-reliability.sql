-- Use a test database. All test accounts and conversations are rolled back.
begin;
do $$
declare
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  morgan uuid := gen_random_uuid();
  sam uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  direct_id uuid;
  group_id uuid;
  retry_id uuid := gen_random_uuid();
  first_device uuid := gen_random_uuid();
  second_device uuid := gen_random_uuid();
  page_cursor record;
  page_length integer;
begin
  insert into auth.users(id, email, raw_user_meta_data)
    select id, id::text || '@family-chat-test.invalid', '{"first_name":"Test","last_name":"Family"}'
    from unnest(array[alice,bob,morgan,sam,outsider]) as users(id);

  insert into public.profiles(id, first_name, last_name)
    select id, 'Test', 'Family' from unnest(array[alice,bob,morgan,sam,outsider]) as users(id)
    on conflict (id) do nothing;

  insert into public.family_connection_requests (requester_user_id, recipient_user_id, relationship_type, status)
  values (alice,bob,'sibling','accepted'), (alice,morgan,'sibling','accepted'),
    (alice,sam,'sibling','accepted'), (outsider,bob,'sibling','pending');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', alice::text, true);
  direct_id := public.create_chat_thread(array[bob]);
  group_id := public.create_chat_thread(array[bob,morgan], 'Family chat test');

  perform set_config('request.jwt.claim.sub', bob::text, true);
  if not exists(select 1 from public.read_chat_names(array[alice]) where id = alice) then
    raise exception 'A reciprocal family connection cannot resolve the display name';
  end if;
  if public.create_chat_thread(array[alice]) is distinct from direct_id then
    raise exception 'A reciprocal direct chat did not reuse the original thread';
  end if;
  begin
    perform public.add_chat_group_members(group_id, array[sam]);
    raise exception 'A non-creator could add a group member';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform public.send_chat_message(group_id, 'An idempotent send', retry_id);
  perform public.send_chat_message(group_id, 'An idempotent send', retry_id);
  select count(*) into page_length from public.read_chat_history(group_id);
  if page_length <> 1 then raise exception 'Retry created a duplicate message'; end if;
  for i in 1..60 loop
    perform public.send_chat_message(group_id, 'History test ' || i::text, gen_random_uuid());
  end loop;
  perform public.add_chat_group_members(group_id, array[sam]);
  perform public.set_chat_activity(first_device, 'typing', group_id);
  perform public.set_chat_activity(second_device, 'typing', group_id);
  perform public.set_chat_activity(first_device, 'leave');

  perform set_config('request.jwt.claim.sub', sam::text, true);
  select count(*) into page_length from public.read_chat_history(group_id);
  if page_length <> 51 then raise exception 'New member could not read the previous history'; end if;
  select created_at,id into page_cursor from public.read_chat_history(group_id) offset 49 limit 1;
  select count(*) into page_length from public.read_chat_history(group_id, page_cursor.created_at, page_cursor.id);
  if page_length <> 11 then raise exception 'Older history page lost or repeated messages'; end if;

  if not exists(select 1 from public.read_chat_activity(group_id) where user_id = alice and typing) then
    raise exception 'A group member could not see the sender typing on the second device';
  end if;
  if exists(select 1 from public.read_chat_activity(direct_id) where typing) then
    raise exception 'Typing state leaked to another conversation';
  end if;
  perform public.leave_chat_group(group_id);
  if exists(select 1 from public.read_chat_history(group_id))
    or exists(select 1 from public.read_chat_activity(group_id)) then
    raise exception 'A former member retained access';
  end if;

  perform set_config('request.jwt.claim.sub', outsider::text, true);
  if exists(select 1 from public.read_chat_history(group_id))
    or exists(select 1 from public.read_chat_activity(group_id))
    or exists(select 1 from public.read_chat_names(array[alice])) then
    raise exception 'An outsider could read private chat data';
  end if;
  begin
    update public.family_connection_requests set status = 'accepted' where requester_user_id = outsider;
    raise exception 'A requester can approve their own family connection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_chat_thread(array[bob]);
    raise exception 'A pending request allowed a new thread';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_chat_activity(gen_random_uuid(), 'typing', group_id);
    raise exception 'An outsider could send a typing signal';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform public.set_chat_activity(second_device, 'stop', group_id);
  perform set_config('request.jwt.claim.sub', bob::text, true);
  if not exists(select 1 from public.read_chat_activity(group_id) where user_id = alice and not typing) then
    raise exception 'Stop typing incorrectly made the sender go offline';
  end if;
  reset role;
end;
$$;
rollback;
select 'PASS: reciprocal direct chat, group creator permissions, retries, full history, presence, typing, and membership' as result;
