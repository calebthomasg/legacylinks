create or replace function public.create_chat_thread(
  recipient_user_ids uuid[],
  thread_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_title text := nullif(btrim(coalesce(thread_title, '')), '');
  cleaned_recipient_ids uuid[];
  recipient_count integer;
  recipient_record record;
  current_person_id uuid;
  existing_thread_id uuid;
  new_thread_id uuid;
  fallback_title text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to create chat threads'
      using errcode = '28000';
  end if;

  select coalesce(array_agg(distinct recipient_id), array[]::uuid[])
  into cleaned_recipient_ids
  from unnest(coalesce(recipient_user_ids, array[]::uuid[])) as recipient_id
  where recipient_id is not null
    and recipient_id <> current_user_id;

  recipient_count := coalesce(array_length(cleaned_recipient_ids, 1), 0);

  if recipient_count = 0 then
    raise exception 'Choose at least one message recipient'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(cleaned_recipient_ids) as recipient_id
    where not exists (
      select 1
      from public.people person
      where person.created_by_user_id = current_user_id
        and person.linked_user_id = recipient_id
    )
  ) then
    raise exception 'Recipients must be linked family members'
      using errcode = '42501';
  end if;

  select person.id
  into current_person_id
  from public.people person
  where person.created_by_user_id = current_user_id
    and person.linked_user_id = current_user_id
  order by person.created_at desc
  limit 1;

  if recipient_count = 1 then
    select thread.id
    into existing_thread_id
    from public.chat_threads thread
    where thread.thread_type = 'direct'
      and thread.deleted_at is null
      and exists (
        select 1
        from public.chat_thread_members member
        where member.thread_id = thread.id
          and member.user_id = current_user_id
          and member.left_at is null
      )
      and exists (
        select 1
        from public.chat_thread_members member
        where member.thread_id = thread.id
          and member.user_id = cleaned_recipient_ids[1]
          and member.left_at is null
      )
      and (
        select count(*)
        from public.chat_thread_members member
        where member.thread_id = thread.id
          and member.left_at is null
      ) = 2
    order by coalesce(thread.last_message_at, thread.updated_at, thread.created_at) desc
    limit 1;

    if existing_thread_id is not null then
      return existing_thread_id;
    end if;

    insert into public.chat_threads (
      thread_type,
      title,
      created_by_user_id
    )
    values (
      'direct',
      null,
      current_user_id
    )
    returning id into new_thread_id;
  else
    select array_to_string(
      array_agg(
        coalesce(
          nullif(person.display_name, ''),
          nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''),
          'Family member'
        )
        order by person.created_at
      ),
      ', '
    )
    into fallback_title
    from public.people person
    where person.created_by_user_id = current_user_id
      and person.linked_user_id = any(cleaned_recipient_ids);

    insert into public.chat_threads (
      thread_type,
      title,
      created_by_user_id
    )
    values (
      'group',
      coalesce(cleaned_title, fallback_title, 'Family group'),
      current_user_id
    )
    returning id into new_thread_id;
  end if;

  insert into public.chat_thread_members (
    thread_id,
    user_id,
    person_id,
    role
  )
  values (
    new_thread_id,
    current_user_id,
    current_person_id,
    'owner'
  )
  on conflict (thread_id, user_id) do update
  set left_at = null,
      role = 'owner',
      updated_at = now();

  for recipient_record in
    select person.linked_user_id as user_id, person.id as person_id
    from public.people person
    where person.created_by_user_id = current_user_id
      and person.linked_user_id = any(cleaned_recipient_ids)
  loop
    insert into public.chat_thread_members (
      thread_id,
      user_id,
      person_id,
      role
    )
    values (
      new_thread_id,
      recipient_record.user_id,
      recipient_record.person_id,
      'member'
    )
    on conflict (thread_id, user_id) do update
    set left_at = null,
        updated_at = now();
  end loop;

  return new_thread_id;
end;
$$;

revoke all on function public.create_chat_thread(uuid[], text)
  from public, anon;

grant execute on function public.create_chat_thread(uuid[], text)
  to authenticated;
