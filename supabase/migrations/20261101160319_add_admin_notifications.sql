-- Event snapshots preserve the name and box details as they were at the event.
create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('signup', 'treasure_find')),
  source_id uuid not null,
  person_name text not null,
  box_title text,
  box_code text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (event_type, source_id)
);
create index admin_notifications_feed_idx on public.admin_notifications (created_at desc, id desc);
create table public.admin_notification_reads (
  admin_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (admin_id, notification_id)
);
create index admin_notification_reads_notification_idx on public.admin_notification_reads(notification_id);
alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;
revoke all on public.admin_notifications, public.admin_notification_reads from anon, authenticated;
grant select on public.admin_notifications, public.admin_notification_reads to authenticated;
grant insert on public.admin_notification_reads to authenticated;
create policy "Admins read notifications" on public.admin_notifications for select to authenticated
  using ((select public.is_legacy_link_admin()));
create policy "Admins read own receipts" on public.admin_notification_reads for select to authenticated
  using (admin_id = (select auth.uid()) and (select public.is_legacy_link_admin()));
create policy "Admins mark own notifications read" on public.admin_notification_reads for insert to authenticated
  with check (admin_id = (select auth.uid()) and (select public.is_legacy_link_admin()));

create schema if not exists private;
create function private.capture_admin_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text; v_title text; v_code text;
begin
  if tg_table_schema = 'auth' and tg_table_name = 'users' then
    v_name := coalesce(nullif(trim(concat_ws(' ', new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')), ''), 'New user');
    insert into public.admin_notifications(event_type, source_id, person_name, occurred_at)
      values ('signup', new.id, v_name, new.created_at) on conflict (event_type, source_id) do nothing;
  elsif tg_table_name = 'treasure_box_finds' then
    if exists (select 1 from public.physical_treasure_boxes b where b.cache_id = new.cache_id and b.inventory_environment = 'testing') then
      return new;
    end if;
    select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Trailblazer') into v_name
      from public.profiles p where p.id = new.user_id;
    select c.title, coalesce(b.serial_code, c.public_code) into v_title, v_code
      from public.caches c left join public.physical_treasure_boxes b on b.cache_id = c.id
      where c.id = new.cache_id limit 1;
    insert into public.admin_notifications(event_type, source_id, person_name, box_title, box_code, occurred_at)
      values ('treasure_find', new.id, coalesce(v_name, 'Trailblazer'), v_title, v_code, new.found_at)
      on conflict (event_type, source_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.capture_admin_notification() from public, anon, authenticated;
create trigger on_auth_user_admin_notification after insert on auth.users
  for each row execute function private.capture_admin_notification();
create trigger on_treasure_find_admin_notification after insert on public.treasure_box_finds
  for each row execute function private.capture_admin_notification();

create function public.list_admin_notifications(p_filter text default 'all', p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_rows jsonb; v_total bigint; v_unread bigint;
begin
  if auth.uid() is null or not public.is_legacy_link_admin() then raise exception 'Admin access required'; end if;
  if p_filter not in ('all', 'unread', 'signup', 'treasure_find') or p_offset < 0 then raise exception 'Invalid notification filter'; end if;
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
create function public.mark_admin_notifications_read(p_notification_id uuid default null, p_through timestamptz default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_legacy_link_admin() then raise exception 'Admin access required'; end if;
  if p_notification_id is null and p_through is null then raise exception 'Notification or cutoff required'; end if;
  insert into public.admin_notification_reads(admin_id, notification_id)
    select auth.uid(), n.id from public.admin_notifications n
    where (p_notification_id is not null and n.id=p_notification_id)
       or (p_notification_id is null and n.created_at<=p_through)
    on conflict do nothing;
end;
$$;
revoke all on function public.list_admin_notifications(text, integer), public.mark_admin_notifications_read(uuid, timestamptz) from public, anon;
grant execute on function public.list_admin_notifications(text, integer), public.mark_admin_notifications_read(uuid, timestamptz) to authenticated;
alter publication supabase_realtime add table public.admin_notifications, public.admin_notification_reads;
