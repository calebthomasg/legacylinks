-- Run as postgres. Every fixture and receipt is rolled back, including on failure.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_admin uuid; v_other uuid; v_token uuid; v_test_token uuid;
  v_find uuid; v_notification uuid; v_count bigint; v_feed jsonb;
begin
  insert into auth.users(id, email, raw_user_meta_data, created_at)
    values(v_user, v_user::text || '@notification-test.invalid', '{"first_name":"Notification","last_name":"Test"}', now());
  if not exists(select 1 from public.profiles where id=v_user and first_name='Notification') then raise exception 'Signup profile missing'; end if;
  if not exists(select 1 from public.admin_notifications where source_id=v_user and person_name='Notification Test' and event_type='signup') then raise exception 'Signup notification missing'; end if;
  select user_id into v_admin from public.admin_users order by created_at limit 1;
  select user_id into v_other from public.admin_users where user_id<>v_admin limit 1;
  select n.public_token into v_token from public.cache_nfc_tags n join public.caches c on c.id=n.cache_id
    join public.physical_treasure_boxes b on b.cache_id=c.id
    where n.status='active' and c.status='active' and b.inventory_environment='production' limit 1;
  select n.public_token into v_test_token from public.cache_nfc_tags n join public.caches c on c.id=n.cache_id
    join public.physical_treasure_boxes b on b.cache_id=c.id
    where n.status='active' and c.status='active' and b.inventory_environment='testing' limit 1;
  if v_admin is null or v_other is null or v_token is null or v_test_token is null then raise exception 'Required admin/box fixtures missing'; end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  set local role authenticated;
  select find_id into v_find from public.record_treasure_box_find(v_token);
  perform public.record_treasure_box_find(v_token);
  perform public.record_treasure_box_find(v_test_token);
  if exists(select 1 from public.admin_notifications) then raise exception 'Regular user can read notifications'; end if;
  begin
    perform public.list_admin_notifications();
    raise exception 'Regular user can call admin feed';
  exception when raise_exception then
    if sqlerrm <> 'Admin access required' then raise; end if;
  end;
  reset role;
  select count(*) into v_count from public.admin_notifications where event_type='treasure_find' and source_id in (select id from public.treasure_box_finds where user_id=v_user);
  if v_count <> 1 then raise exception 'Duplicate or test-box notification: %',v_count; end if;
  select id into v_notification from public.admin_notifications where source_id=v_find and event_type='treasure_find';
  if v_notification is null then raise exception 'Find notification missing'; end if;
  update public.treasure_box_finds set comment='Feedback must not create another notification' where id=v_find;
  if (select count(*) from public.admin_notifications where source_id=v_find)<>1 then raise exception 'Feedback duplicated alert'; end if;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  set local role authenticated;
  v_feed := public.list_admin_notifications('treasure_find',0);
  if (v_feed->>'total')::integer < 1 then raise exception 'Admin feed missing find'; end if;
  perform public.mark_admin_notifications_read(v_notification);
  perform public.mark_admin_notifications_read(v_notification);
  if not exists(select 1 from public.admin_notification_reads where notification_id=v_notification) then raise exception 'Receipt missing'; end if;
  begin
    insert into public.admin_notification_reads(admin_id,notification_id) values(v_other,v_notification);
    raise exception 'Admin can forge another receipt';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  set local role authenticated;
  if exists(select 1 from public.admin_notification_reads where notification_id=v_notification) then raise exception 'Read status leaked between admins'; end if;
  perform public.mark_admin_notifications_read(null,now());
  if (public.list_admin_notifications()->>'unread')::integer <> 0 then raise exception 'Mark all failed'; end if;
  reset role;
  if has_table_privilege('anon','public.admin_notifications','SELECT') then raise exception 'Anonymous table access'; end if;
  if has_table_privilege('authenticated','public.admin_notifications','INSERT') then raise exception 'Clients can forge notifications'; end if;
end;
$$;
rollback;
select 'PASS: signup, find RPC, duplicates, test exclusion, feedback, admin feed, receipts, mark-all and permissions; fixtures rolled back' as result;
