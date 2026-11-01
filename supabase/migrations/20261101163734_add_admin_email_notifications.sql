-- Email delivery runs independently of user requests; no paid email plan required.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table private.admin_email_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into private.admin_email_settings values(true,false);
create table private.admin_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  recipient text not null,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','in_flight','accepted','failed','cancelled')),
  attempts integer not null default 0,
  request_id bigint,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  accepted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(notification_id,admin_id)
);
create index admin_email_deliveries_due_idx on private.admin_email_deliveries(next_attempt_at,created_at) where status='pending';
create index admin_email_deliveries_admin_idx on private.admin_email_deliveries(admin_id);
create table private.admin_email_attempts (
  request_id bigint primary key,
  delivery_id uuid not null references private.admin_email_deliveries(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index admin_email_attempts_time_idx on private.admin_email_attempts(attempted_at);
create index admin_email_attempts_delivery_idx on private.admin_email_attempts(delivery_id);
alter table private.admin_email_settings enable row level security;
alter table private.admin_email_deliveries enable row level security;
alter table private.admin_email_attempts enable row level security;
revoke all on private.admin_email_settings,private.admin_email_deliveries,private.admin_email_attempts from public,anon,authenticated;

create function private.enqueue_admin_notification_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_subject text; v_text text;
begin
  v_subject := case new.event_type when 'signup' then 'LegacyLink: New account created' else 'LegacyLink: Treasure box found' end;
  v_text := case new.event_type when 'signup' then
    new.person_name || ' created a LegacyLink account.' || E'\nAccount created: '
    else new.person_name || ' found ' || coalesce(new.box_title,'a treasure box') || coalesce(' ('||new.box_code||')','') || E'.\nFound: ' end
    || to_char(new.occurred_at at time zone 'America/Chicago','Mon DD, YYYY HH12:MI AM') || ' America/Chicago'
    || E'\n\nView your admin dashboard: https://www.legacylinks.io/admin#admin-notifications';
  insert into private.admin_email_deliveries(notification_id,admin_id,recipient,payload)
    select new.id,a.user_id,lower(trim(u.email)),jsonb_build_object(
      'from','LegacyLink <support@legacylinks.io>','to',jsonb_build_array(lower(trim(u.email))),
      'subject',v_subject,'text',v_text)
    from public.admin_users a join auth.users u on u.id=a.user_id
    where a.role in ('super_admin','admin','fulfillment') and nullif(trim(u.email),'') is not null
    on conflict(notification_id,admin_id) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_admin_notification_email() from public,anon,authenticated;
create trigger on_admin_notification_email after insert on public.admin_notifications
  for each row execute function private.enqueue_admin_notification_email();

create function private.dispatch_admin_notification_emails() returns void
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
      where a.user_id=q.admin_id and a.role in ('super_admin','admin','fulfillment') and lower(trim(u.email))=q.recipient);
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
revoke all on function private.dispatch_admin_notification_emails() from public,anon,authenticated;
select cron.schedule('admin-notification-emails','* * * * *','select private.dispatch_admin_notification_emails();');
