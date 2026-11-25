alter table public.admin_notifications drop constraint admin_notifications_event_type_check;
alter table public.admin_notifications
  add constraint admin_notifications_event_type_check check (event_type in ('signup','treasure_find','family_chat_issue')),
  add column issue_description text,
  add column chat_thread_id uuid;

-- Keep Family Chat reports visible only to full admins and super admins.
drop policy "Admins read notifications" on public.admin_notifications;
create policy "Admins read notifications" on public.admin_notifications for select to authenticated
  using ((select public.is_legacy_link_admin()) and (
    event_type <> 'family_chat_issue' or exists (
      select 1 from public.admin_users a where a.user_id = (select auth.uid())
        and a.role in ('admin','super_admin')
    )
  ));

create or replace function public.list_admin_notifications(p_filter text default 'all', p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_rows jsonb; v_total bigint; v_unread bigint;
begin
  if auth.uid() is null or not public.is_legacy_link_admin() then raise exception 'Admin access required'; end if;
  if p_filter not in ('all', 'unread', 'signup', 'treasure_find', 'family_chat_issue') or p_offset < 0 then raise exception 'Invalid notification filter'; end if;
  select count(*) into v_unread from public.admin_notifications n where not exists
    (select 1 from public.admin_notification_reads r where r.notification_id=n.id and r.admin_id=auth.uid());
  select count(*) into v_total from public.admin_notifications n where
    (p_filter='all' or n.event_type=p_filter or (p_filter='unread' and not exists
      (select 1 from public.admin_notification_reads r where r.notification_id=n.id and r.admin_id=auth.uid())));
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc), '[]'::jsonb) into v_rows from (
    select n.*, exists(select 1 from public.admin_notification_reads r where r.notification_id=n.id and r.admin_id=auth.uid()) as is_read
    from public.admin_notifications n where
      (p_filter='all' or n.event_type=p_filter or (p_filter='unread' and not exists
        (select 1 from public.admin_notification_reads r where r.notification_id=n.id and r.admin_id=auth.uid())))
    order by n.created_at desc, n.id desc limit 20 offset p_offset
  ) page;
  return jsonb_build_object('rows',v_rows,'total',v_total,'unread',v_unread);
end;
$$;
create or replace function private.enqueue_admin_notification_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_content jsonb;
begin
  if new.event_type = 'family_chat_issue' then
    v_content := jsonb_build_object(
      'subject','LegacyLink: New Family Chat issue',
      'text','A Family Chat issue was reported. Review the report in Notifications on the LegacyLink admin dashboard.'
        || E'\n\nhttps://www.legacylinks.io/admin#admin-notifications');
  else
    v_content := private.render_admin_notification_email(new);
  end if;
  insert into private.admin_email_deliveries(notification_id,admin_id,recipient,payload)
    select new.id,a.user_id,lower(trim(u.email)),v_content||jsonb_build_object(
      'from','LegacyLink <support@legacylinks.io>','to',jsonb_build_array(lower(trim(u.email))))
    from public.admin_users a join auth.users u on u.id=a.user_id
    where (a.role in ('super_admin','admin') or (a.role = 'fulfillment' and new.event_type <> 'family_chat_issue')) and nullif(trim(u.email),'') is not null
    on conflict(notification_id,admin_id) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_admin_notification_email() from public,anon,authenticated;
create or replace function private.dispatch_admin_notification_emails() returns void
language plpgsql security definer set search_path='' as $$
declare d record; r record; v_key text; v_request bigint;
begin
  -- Only one dispatcher may reserve quota or send at once.
  if not pg_try_advisory_xact_lock(793412050) then return; end if;
  -- A response means provider acceptance, not proof of inbox delivery.
  for d in select * from private.admin_email_deliveries where status='in_flight' for update loop
    select * into r from net._http_response where id=d.request_id;
    if found and r.status_code between 200 and 299 then
      update private.admin_email_deliveries set status='accepted',accepted_at=now(),last_error=null where id=d.id;
    elsif found and r.status_code between 400 and 499 and r.status_code not in (408,409,429) then
      update private.admin_email_deliveries set status='failed',last_error='Email provider rejected request (HTTP '||r.status_code||')' where id=d.id;
    elsif found or d.last_attempt_at < now()-interval '2 minutes' then
      update private.admin_email_deliveries set
        status=case when attempts>=8 or first_attempt_at<now()-interval '23 hours' then 'failed' else 'pending' end,
        next_attempt_at=now()+make_interval(mins=>least(30,power(2,attempts)::integer)),
        last_error=case when r.status_code is not null then 'HTTP '||r.status_code else 'No confirmed provider response' end
        where id=d.id;
    end if;
  end loop;
  if not (select enabled from private.admin_email_settings where singleton) then return; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name='admin_notifications_resend_api_key' limit 1;
  if nullif(v_key,'') is null then return; end if;
  -- Conservative rolling limits count every attempt, including retries.
  -- The provider's Free-plan cap also applies to other apps sharing this account.
  if (select count(*) from private.admin_email_attempts where attempted_at>now()-interval '24 hours')>=90
    or (select count(*) from private.admin_email_attempts where attempted_at>now()-interval '31 days')>=2900 then return; end if;
  update private.admin_email_deliveries q set status='cancelled',last_error='Recipient no longer has admin access or email changed'
    where q.status='pending' and not exists(select 1 from public.admin_users a join auth.users u on u.id=a.user_id
      where a.user_id=q.admin_id and a.role in ('super_admin','admin','fulfillment') and lower(trim(u.email))=q.recipient
        and (a.role <> 'fulfillment' or not exists (select 1 from public.admin_notifications n
          where n.id=q.notification_id and n.event_type='family_chat_issue')));
  update private.admin_email_deliveries set status='failed',last_error='Retry window expired; manual review required'
    where status='pending' and first_attempt_at<now()-interval '23 hours';
  -- One request per minute stays well below provider per-second limits.
  for d in select * from private.admin_email_deliveries where status='pending' and next_attempt_at<=now()
    order by created_at,id limit 1 for update skip locked loop
    v_request := net.http_post(url:='https://api.resend.com/emails',body:=d.payload,
      headers:=jsonb_build_object('Authorization','Bearer '||v_key,'Content-Type','application/json','Idempotency-Key','admin-alert/'||d.id),
      timeout_milliseconds:=10000);
    update private.admin_email_deliveries set status='in_flight',request_id=v_request,attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,now()),last_attempt_at=now() where id=d.id;
    insert into private.admin_email_attempts(request_id,delivery_id) values(v_request,d.id);
  end loop;
end;
$$;

create function private.capture_chat_issue_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reporter_name text;
begin
  select nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')
    into reporter_name from public.profiles p where p.id = new.reporter_id;
  insert into public.admin_notifications(event_type,source_id,person_name,occurred_at,issue_description,chat_thread_id)
    values('family_chat_issue',new.id,coalesce(reporter_name,'Family Chat member'),new.created_at,new.description,new.thread_id);
  return new;
end;
$$;
revoke all on function private.capture_chat_issue_notification() from public, anon, authenticated;
create trigger on_chat_issue_admin_notification after insert on public.chat_issue_reports
  for each row execute function private.capture_chat_issue_notification();
