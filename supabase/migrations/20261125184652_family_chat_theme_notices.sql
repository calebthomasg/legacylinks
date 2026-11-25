alter table public.chat_messages add column theme_change_id text
  check (theme_change_id is null or not removed_for_everyone);

create or replace function public.save_chat_appearance(thread_uuid uuid, theme text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  applied_theme text := nullif(theme, 'default');
  theme_label text;
  actor_name text;
begin
  if actor is null or not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  update public.chat_threads t set theme_id = applied_theme
  where t.id = thread_uuid and t.deleted_at is null
    and t.theme_id is distinct from applied_theme;
  if not found then return; end if;

  theme_label := case applied_theme
    when 'under-the-spotlight' then 'Under the Spotlight'
    when 'sunflower-after-rain' then 'Sunflower After Rain'
    when 'river-at-dawn' then 'River at Dawn'
    when 'among-the-pines' then 'Among the Pines'
    when 'balloon-at-sunrise' then 'Balloon at Sunrise'
    else coalesce(initcap(replace(applied_theme, '-', ' ')), 'LegacyLink')
  end;

  select nullif(btrim(concat_ws(' ', nullif(btrim(p.first_name), ''), nullif(btrim(p.last_name), ''))), '')
  into actor_name from public.profiles p where p.id = actor;

  if actor_name is null then
    select coalesce(nullif(btrim(p.display_name), ''),
      nullif(btrim(concat_ws(' ', nullif(btrim(p.first_name), ''), nullif(btrim(p.last_name), ''))), ''))
    into actor_name from public.people p
    where p.linked_user_id = actor and p.created_by_user_id = actor
    order by p.created_at desc, p.id desc limit 1;
  end if;

  insert into public.chat_messages(thread_id, sender_user_id, body, theme_change_id, created_at)
  values (thread_uuid, actor, coalesce(actor_name, 'A family member') || ' changed theme to ' || theme_label,
          coalesce(applied_theme, 'default'), clock_timestamp());
end;
$$;
