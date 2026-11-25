alter table public.chat_threads add column theme_id text
  check (theme_id in ('orbital-drift','forest-crossing','starlit-arch','lavender-glow','alpine-ridge','morning-balloon','night-drive','crimson-moon','quiet-canoe','under-the-spotlight','autumn-canyon','twilight-peaks','turquoise-coast','sunflower-after-rain','coastal-sunset','dune-moon','emerald-canopy','painted-valley','river-at-dawn','among-the-pines','galaxy-watch','eclipse','desert-stars','misty-evergreens','balloon-at-sunrise','paper-mountains'));
alter table public.chat_thread_members
  add column muted_until timestamptz,
  add column message_alerts boolean not null default true,
  add column notification_tone text not null default 'default'
    check (notification_tone in ('default','silent','analog-fx-8','beeps-bonks-boinks-3','digital-alert-triple-bell-bosnow-2-2-00-00','dragon-studio-notification-bell-sound-1-376885','elec-01','notification-delayed-digital-bell-smartsound-fx-2-00-01','universfield-bright-notification-352449','universfield-message-notification-124467','universfield-new-notification-035-485894','universfield-new-notification-056-494256','universfield-new-notification-057-494255','universfield-new-notification-07-210334','universfield-notification-beep-229154'));

create function public.save_chat_appearance(thread_uuid uuid, theme text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  update public.chat_threads t set theme_id = nullif(theme, 'default')
  where t.id = thread_uuid and t.deleted_at is null
    and t.theme_id is distinct from nullif(theme, 'default');
end;
$$;

create function public.set_chat_notification_preference(thread_uuid uuid, setting text, preference text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  if setting = 'mute' and preference in ('0','15','60','480','1440','-1') then
    update public.chat_thread_members m
    set muted_at = case when preference <> '0' then now() end,
        muted_until = case when preference not in ('0','-1') then now() + make_interval(mins => preference::integer) end
    where m.thread_id = thread_uuid and m.user_id = auth.uid() and m.left_at is null;
  elsif setting = 'messages' and preference in ('all','none') then
    update public.chat_thread_members m set message_alerts = preference = 'all'
    where m.thread_id = thread_uuid and m.user_id = auth.uid() and m.left_at is null;
  elsif setting = 'tone' and preference is not null then
    update public.chat_thread_members m set notification_tone = preference, play_sounds = preference <> 'silent'
    where m.thread_id = thread_uuid and m.user_id = auth.uid() and m.left_at is null;
  else
    raise exception 'Invalid notification preference' using errcode = '22023';
  end if;
end;
$$;

-- Older preview clients can still switch sound on or off and must clear any timed mute.
create or replace function public.save_chat_notification_settings(thread_uuid uuid, mute_chat boolean, sounds boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_chat_thread_member(thread_uuid) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  update public.chat_thread_members m
  set muted_at = case when mute_chat then coalesce(m.muted_at, now()) end,
      muted_until = null, play_sounds = coalesce(sounds,false),
      notification_tone = case when sounds and m.notification_tone = 'silent' then 'default' else m.notification_tone end
  where m.thread_id = thread_uuid and m.user_id = auth.uid() and m.left_at is null;
end;
$$;

revoke all on function public.save_chat_appearance(uuid,text), public.set_chat_notification_preference(uuid,text,text) from public, anon;
grant execute on function public.save_chat_appearance(uuid,text), public.set_chat_notification_preference(uuid,text,text) to authenticated;
