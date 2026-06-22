create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  thread_type text not null,
  title text,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_threads_thread_type_check
    check (thread_type in ('direct', 'group'))
);

create table if not exists public.chat_thread_members (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  role text not null default 'member',
  muted_at timestamptz,
  left_at timestamptz,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_thread_members_role_check
    check (role in ('owner', 'member')),
  constraint chat_thread_members_thread_user_unique
    unique (thread_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_messages_body_check
    check (length(trim(body)) > 0 and length(body) <= 4000)
);

create index if not exists chat_threads_created_by_user_id_idx
  on public.chat_threads(created_by_user_id);

create index if not exists chat_threads_last_message_at_desc_idx
  on public.chat_threads(last_message_at desc);

create index if not exists chat_threads_deleted_at_idx
  on public.chat_threads(deleted_at);

create index if not exists chat_thread_members_user_id_idx
  on public.chat_thread_members(user_id);

create index if not exists chat_thread_members_thread_id_idx
  on public.chat_thread_members(thread_id);

create index if not exists chat_thread_members_thread_id_user_id_idx
  on public.chat_thread_members(thread_id, user_id);

create index if not exists chat_thread_members_person_id_idx
  on public.chat_thread_members(person_id);

create index if not exists chat_messages_thread_id_created_at_desc_idx
  on public.chat_messages(thread_id, created_at desc);

create index if not exists chat_messages_sender_user_id_idx
  on public.chat_messages(sender_user_id);

create index if not exists chat_messages_deleted_at_idx
  on public.chat_messages(deleted_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_chat_threads_updated_at
  on public.chat_threads;
create trigger set_chat_threads_updated_at
  before update on public.chat_threads
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_chat_thread_members_updated_at
  on public.chat_thread_members;
create trigger set_chat_thread_members_updated_at
  before update on public.chat_thread_members
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_chat_messages_updated_at
  on public.chat_messages;
create trigger set_chat_messages_updated_at
  before update on public.chat_messages
  for each row
  execute function public.set_updated_at();

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

create or replace function public.is_chat_thread_member(thread_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_thread_members member
    join public.chat_threads thread on thread.id = member.thread_id
    where member.thread_id = thread_uuid
      and member.user_id = auth.uid()
      and member.left_at is null
      and thread.deleted_at is null
  );
$$;

create or replace function public.is_chat_thread_owner(thread_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_threads thread
    where thread.id = thread_uuid
      and thread.deleted_at is null
      and (
        thread.created_by_user_id = auth.uid()
        or exists (
          select 1
          from public.chat_thread_members member
          where member.thread_id = thread_uuid
            and member.user_id = auth.uid()
            and member.role = 'owner'
            and member.left_at is null
        )
      )
  );
$$;

grant execute on function public.is_chat_thread_member(uuid)
  to authenticated;

grant execute on function public.is_chat_thread_owner(uuid)
  to authenticated;

create or replace function public.prevent_chat_member_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_chat_thread_owner(old.thread_id) then
    return new;
  end if;

  if old.user_id = auth.uid() then
    if new.id is distinct from old.id
      or new.thread_id is distinct from old.thread_id
      or new.user_id is distinct from old.user_id
      or new.person_id is distinct from old.person_id
      or new.role is distinct from old.role
      or new.joined_at is distinct from old.joined_at
      or new.created_at is distinct from old.created_at then
      raise exception 'Only muted_at, left_at, and last_read_at can be changed on your membership row.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_chat_member_privilege_escalation
  on public.chat_thread_members;
create trigger prevent_chat_member_privilege_escalation
  before update on public.chat_thread_members
  for each row
  execute function public.prevent_chat_member_privilege_escalation();

create or replace function public.prevent_chat_message_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.thread_id is distinct from old.thread_id
    or new.sender_user_id is distinct from old.sender_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Message identity fields cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_chat_message_identity_change
  on public.chat_messages;
create trigger prevent_chat_message_identity_change
  before update on public.chat_messages
  for each row
  execute function public.prevent_chat_message_identity_change();

drop policy if exists "Members can view active chat threads"
  on public.chat_threads;
create policy "Members can view active chat threads"
  on public.chat_threads
  for select
  using (public.is_chat_thread_member(id));

drop policy if exists "Users can create chat threads"
  on public.chat_threads;
create policy "Users can create chat threads"
  on public.chat_threads
  for insert
  with check (created_by_user_id = auth.uid());

drop policy if exists "Owners can update chat threads"
  on public.chat_threads;
create policy "Owners can update chat threads"
  on public.chat_threads
  for update
  using (public.is_chat_thread_owner(id))
  with check (
    created_by_user_id = auth.uid()
    or exists (
      select 1
      from public.chat_thread_members member
      where member.thread_id = id
        and member.user_id = auth.uid()
        and member.role = 'owner'
        and member.left_at is null
    )
  );

drop policy if exists "Members can view members in their chat threads"
  on public.chat_thread_members;
create policy "Members can view members in their chat threads"
  on public.chat_thread_members
  for select
  using (public.is_chat_thread_member(thread_id));

drop policy if exists "Thread owners can add chat members"
  on public.chat_thread_members;
create policy "Thread owners can add chat members"
  on public.chat_thread_members
  for insert
  with check (
    exists (
      select 1
      from public.chat_threads thread
      where thread.id = thread_id
        and thread.deleted_at is null
        and thread.created_by_user_id = auth.uid()
    )
    or public.is_chat_thread_owner(thread_id)
  );

drop policy if exists "Users can update their own chat membership"
  on public.chat_thread_members;
create policy "Users can update their own chat membership"
  on public.chat_thread_members
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_threads thread
      where thread.id = thread_id
        and thread.deleted_at is null
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_threads thread
      where thread.id = thread_id
        and thread.deleted_at is null
    )
  );

drop policy if exists "Owners can update chat memberships"
  on public.chat_thread_members;
create policy "Owners can update chat memberships"
  on public.chat_thread_members
  for update
  using (public.is_chat_thread_owner(thread_id))
  with check (
    exists (
      select 1
      from public.chat_threads thread
      where thread.id = thread_id
        and thread.deleted_at is null
    )
  );

drop policy if exists "Members can view active chat messages"
  on public.chat_messages;
create policy "Members can view active chat messages"
  on public.chat_messages
  for select
  using (
    deleted_at is null
    and public.is_chat_thread_member(thread_id)
  );

drop policy if exists "Members can create chat messages"
  on public.chat_messages;
create policy "Members can create chat messages"
  on public.chat_messages
  for insert
  with check (
    sender_user_id = auth.uid()
    and deleted_at is null
    and public.is_chat_thread_member(thread_id)
  );

drop policy if exists "Users can update their own chat messages"
  on public.chat_messages;
create policy "Users can update their own chat messages"
  on public.chat_messages
  for update
  using (
    sender_user_id = auth.uid()
    and exists (
      select 1
      from public.chat_threads thread
      where thread.id = thread_id
        and thread.deleted_at is null
    )
  )
  with check (
    sender_user_id = auth.uid()
    and public.is_chat_thread_member(thread_id)
  );

-- TODO: prevent duplicate direct conversations with a find-or-create RPC in a
-- later phase. A clean approach is to normalize the two user ids into a stable
-- direct-thread key and enforce uniqueness through the RPC/table design.
