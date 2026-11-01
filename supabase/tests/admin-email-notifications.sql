-- No real email is sent: pg_net requests only execute after COMMIT; this test rolls back.
begin;
do $$
declare v_notice uuid:=gen_random_uuid(); v_admins integer; d record; v_request bigint;
begin
  update private.admin_email_settings set enabled=false;
  select count(*) into v_admins from public.admin_users a join auth.users u on u.id=a.user_id
    where a.role in ('super_admin','admin','fulfillment') and nullif(trim(u.email),'') is not null;
  insert into public.admin_notifications(id,event_type,source_id,person_name,occurred_at)
    values(v_notice,'signup',gen_random_uuid(),'Email Queue Test',now());
  if (select count(*) from private.admin_email_deliveries where notification_id=v_notice)<>v_admins then raise exception 'Not all admins queued'; end if;
  select * into d from private.admin_email_deliveries where notification_id=v_notice limit 1;
  if d.payload->>'from'<>'LegacyLink <support@legacylinks.io>' or d.payload->>'text' not like '%Email Queue Test%' then raise exception 'Incorrect email content'; end if;
  perform private.dispatch_admin_notification_emails();
  if exists(select 1 from private.admin_email_deliveries where notification_id=v_notice and status<>'pending') then raise exception 'Disabled worker sent mail'; end if;
  -- Responses are synthetic and rolled back with all fixtures.
  update private.admin_email_deliveries set status='in_flight',request_id=-1001,attempts=1,first_attempt_at=now(),last_attempt_at=now() where id=d.id;
  insert into net._http_response(id,status_code,content) values(-1001,200,'{"id":"test"}');
  perform private.dispatch_admin_notification_emails();
  if (select status from private.admin_email_deliveries where id=d.id)<>'accepted' then raise exception 'Success not recorded'; end if;
  update private.admin_email_deliveries set status='in_flight',request_id=-1002 where id=d.id;
  insert into net._http_response(id,status_code) values(-1002,429);
  perform private.dispatch_admin_notification_emails();
  if not exists(select 1 from private.admin_email_deliveries where id=d.id and status='pending' and next_attempt_at>now()) then raise exception 'Retry backoff missing'; end if;
  update private.admin_email_deliveries set status='in_flight',request_id=-1003 where id=d.id;
  insert into net._http_response(id,status_code) values(-1003,422);
  perform private.dispatch_admin_notification_emails();
  if (select status from private.admin_email_deliveries where id=d.id)<>'failed' then raise exception 'Permanent rejection retried'; end if;
  update private.admin_email_deliveries set status='in_flight',request_id=-1004,attempts=8 where id=d.id;
  insert into net._http_response(id,status_code) values(-1004,500);
  perform private.dispatch_admin_notification_emails();
  if (select status from private.admin_email_deliveries where id=d.id)<>'failed' then raise exception 'Retry limit not enforced'; end if;
  -- Temporary credential lives only inside this rolled-back transaction.
  if not exists(select 1 from vault.secrets where name='admin_notifications_resend_api_key') then
    perform vault.create_secret('re_test_not_a_real_key','admin_notifications_resend_api_key');
  end if;
  update private.admin_email_settings set enabled=true;
  update private.admin_email_deliveries set status='pending',attempts=0,first_attempt_at=null,next_attempt_at=now() where id=d.id;
  perform private.dispatch_admin_notification_emails();
  select request_id into v_request from private.admin_email_deliveries where status='in_flight' and last_attempt_at=now() order by created_at limit 1;
  if v_request is null then raise exception 'No HTTP request queued'; end if;
  if not exists(select 1 from net.http_request_queue where id=v_request and headers->>'Idempotency-Key' like 'admin-alert/%') then raise exception 'Idempotency header missing'; end if;
  -- Fill the conservative rolling daily allowance; a further dispatch must not send.
  insert into private.admin_email_attempts(request_id,delivery_id)
    select -2000-g,d.id from generate_series(1,90) g;
  select count(*) into v_admins from net.http_request_queue;
  perform private.dispatch_admin_notification_emails();
  if (select count(*) from net.http_request_queue)<>v_admins then raise exception 'Free-plan daily guard failed'; end if;
  if has_table_privilege('authenticated','private.admin_email_deliveries','SELECT') then raise exception 'Client can read private deliveries'; end if;
  if has_function_privilege('authenticated','private.dispatch_admin_notification_emails()','EXECUTE') then raise exception 'Client can dispatch mail'; end if;
end;
$$;
rollback;
select 'PASS: all admins, email content, disabled state, accepted response, backoff, permanent errors, retry cap, idempotency, free quota and permissions; no email sent' as result;
