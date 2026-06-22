create or replace function public.send_chat_message(
  thread_uuid uuid,
  message_body text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_body text := btrim(coalesce(message_body, ''));
  inserted_message public.chat_messages;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to send chat messages'
      using errcode = '28000';
  end if;

  if cleaned_body = '' then
    raise exception 'Message body cannot be empty'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.chat_threads thread
    join public.chat_thread_members member
      on member.thread_id = thread.id
    where thread.id = thread_uuid
      and thread.deleted_at is null
      and member.user_id = current_user_id
      and member.left_at is null
  ) then
    raise exception 'You are not an active member of this chat thread'
      using errcode = '42501';
  end if;

  insert into public.chat_messages (
    thread_id,
    sender_user_id,
    body
  )
  values (
    thread_uuid,
    current_user_id,
    cleaned_body
  )
  returning * into inserted_message;

  update public.chat_threads
  set last_message_at = inserted_message.created_at
  where id = thread_uuid
    and deleted_at is null;

  return inserted_message;
end;
$$;

revoke all on function public.send_chat_message(uuid, text)
  from public, anon;

grant execute on function public.send_chat_message(uuid, text)
  to authenticated;
