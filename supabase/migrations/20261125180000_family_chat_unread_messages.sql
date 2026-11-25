-- Keep the viewer's private unread position independent of shared receipts.
create or replace function public.mark_chat_read(thread_uuid uuid, message_uuid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  message_at timestamptz;
begin
  if viewer is null or not public.is_chat_thread_member(thread_uuid) then return; end if;

  select m.created_at into message_at
  from public.chat_messages m
  join public.chat_threads t on t.id = m.thread_id and t.deleted_at is null
  where m.id = message_uuid and m.thread_id = thread_uuid
    and (m.deleted_at is null or m.removed_for_everyone);
  if message_at is null then return; end if;

  update public.chat_thread_members
  set last_read_at = message_at
  where thread_id = thread_uuid and user_id = viewer and left_at is null
    and (last_read_at is null or last_read_at < message_at);

  insert into public.chat_read_positions(thread_id, user_id, read_through)
  select thread_uuid, viewer, message_at
  where exists (
    select 1 from public.chat_privacy p where p.user_id = viewer and p.show_read_receipts
  )
  on conflict(thread_id, user_id) do update set read_through = excluded.read_through
  where chat_read_positions.read_through < excluded.read_through;
end;
$$;

create function public.count_unread_chat_messages()
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*)
  from public.chat_thread_members mine
  join public.chat_threads t on t.id = mine.thread_id and t.deleted_at is null
  left join public.chat_read_positions p on p.thread_id = mine.thread_id and p.user_id = mine.user_id
  join public.chat_messages m on m.thread_id = mine.thread_id
    and m.created_at > greatest(mine.joined_at, mine.last_read_at, p.read_through)
    and m.sender_user_id <> mine.user_id
    and m.deleted_at is null
  where mine.user_id = (select auth.uid()) and mine.left_at is null;
$$;

revoke all on function public.count_unread_chat_messages() from public, anon;
grant execute on function public.count_unread_chat_messages() to authenticated;
