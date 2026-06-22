create table if not exists public.journal_image_likes (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.journal_entry_images(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (image_id, user_id)
);

create table if not exists public.journal_image_comments (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.journal_entry_images(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.journal_image_comments(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_image_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.journal_image_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists journal_image_likes_image_id_idx
  on public.journal_image_likes(image_id);

create index if not exists journal_image_comments_image_id_created_at_idx
  on public.journal_image_comments(image_id, created_at);

create index if not exists journal_image_comments_parent_comment_id_idx
  on public.journal_image_comments(parent_comment_id);

create index if not exists journal_image_comment_likes_comment_id_idx
  on public.journal_image_comment_likes(comment_id);

alter table public.journal_image_likes enable row level security;
alter table public.journal_image_comments enable row level security;
alter table public.journal_image_comment_likes enable row level security;

create or replace function public.user_owns_journal_image(
  target_image_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_entry_images image
    where image.id = target_image_id
      and image.user_id = target_user_id
  );
$$;

create or replace function public.journal_image_comment_belongs_to_image(
  target_comment_id uuid,
  target_image_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_image_comments comment
    where comment.id = target_comment_id
      and comment.image_id = target_image_id
  );
$$;

create or replace function public.user_owns_journal_image_comment(
  target_comment_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_image_comments comment
    join public.journal_entry_images image on image.id = comment.image_id
    where comment.id = target_comment_id
      and image.user_id = target_user_id
  );
$$;

grant execute on function public.user_owns_journal_image(uuid, uuid)
  to authenticated;
grant execute on function public.journal_image_comment_belongs_to_image(uuid, uuid)
  to authenticated;
grant execute on function public.user_owns_journal_image_comment(uuid, uuid)
  to authenticated;

drop policy if exists "Users can view likes on their images"
  on public.journal_image_likes;
create policy "Users can view likes on their images"
  on public.journal_image_likes
  for select
  using (public.user_owns_journal_image(image_id, auth.uid()));

drop policy if exists "Users can like their images"
  on public.journal_image_likes;
create policy "Users can like their images"
  on public.journal_image_likes
  for insert
  with check (
    user_id = auth.uid()
    and public.user_owns_journal_image(image_id, auth.uid())
  );

drop policy if exists "Users can remove their image likes"
  on public.journal_image_likes;
create policy "Users can remove their image likes"
  on public.journal_image_likes
  for delete
  using (user_id = auth.uid());

drop policy if exists "Users can view comments on their images"
  on public.journal_image_comments;
create policy "Users can view comments on their images"
  on public.journal_image_comments
  for select
  using (public.user_owns_journal_image(image_id, auth.uid()));

drop policy if exists "Users can comment on their images"
  on public.journal_image_comments;
create policy "Users can comment on their images"
  on public.journal_image_comments
  for insert
  with check (
    user_id = auth.uid()
    and public.user_owns_journal_image(image_id, auth.uid())
    and (
      parent_comment_id is null
      or public.journal_image_comment_belongs_to_image(
        parent_comment_id,
        image_id
      )
    )
  );

drop policy if exists "Users can edit their image comments"
  on public.journal_image_comments;
create policy "Users can edit their image comments"
  on public.journal_image_comments
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their image comments"
  on public.journal_image_comments;
create policy "Users can delete their image comments"
  on public.journal_image_comments
  for delete
  using (user_id = auth.uid());

drop policy if exists "Users can view comment likes on their images"
  on public.journal_image_comment_likes;
create policy "Users can view comment likes on their images"
  on public.journal_image_comment_likes
  for select
  using (public.user_owns_journal_image_comment(comment_id, auth.uid()));

drop policy if exists "Users can like comments on their images"
  on public.journal_image_comment_likes;
create policy "Users can like comments on their images"
  on public.journal_image_comment_likes
  for insert
  with check (
    user_id = auth.uid()
    and public.user_owns_journal_image_comment(comment_id, auth.uid())
  );

drop policy if exists "Users can remove their comment likes"
  on public.journal_image_comment_likes;
create policy "Users can remove their comment likes"
  on public.journal_image_comment_likes
  for delete
  using (user_id = auth.uid());
