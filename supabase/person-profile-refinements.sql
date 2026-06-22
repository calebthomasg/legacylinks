alter table public.people
  add column if not exists cover_photo_path text,
  add column if not exists notes text,
  add column if not exists sex text,
  add column if not exists birth_place text,
  add column if not exists death_place text,
  add column if not exists burial_date date,
  add column if not exists burial_place text,
  add column if not exists christening_date date,
  add column if not exists christening_place text,
  add column if not exists baptism_date date,
  add column if not exists baptism_place text;

create table if not exists public.person_profile_photos (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  uploaded_by_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.person_alternate_names (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.person_life_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  event_date date,
  event_place text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_profile_photos_person_id_idx
  on public.person_profile_photos(person_id);

create index if not exists person_profile_photos_uploaded_by_user_id_idx
  on public.person_profile_photos(uploaded_by_user_id);

create index if not exists person_alternate_names_person_id_idx
  on public.person_alternate_names(person_id);

create index if not exists person_life_events_person_id_idx
  on public.person_life_events(person_id);

alter table public.person_profile_photos enable row level security;
alter table public.person_alternate_names enable row level security;
alter table public.person_life_events enable row level security;

drop policy if exists "Users can view their own person profile photos"
  on public.person_profile_photos;
create policy "Users can view their own person profile photos"
  on public.person_profile_photos
  for select
  using (uploaded_by_user_id = auth.uid());

drop policy if exists "Users can create profile photos for editable people"
  on public.person_profile_photos;
create policy "Users can create profile photos for editable people"
  on public.person_profile_photos
  for insert
  with check (
    uploaded_by_user_id = auth.uid()
    and exists (
      select 1
      from public.people person
      where person.id = person_id
        and person.created_by_user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own person profile photos"
  on public.person_profile_photos;
create policy "Users can update their own person profile photos"
  on public.person_profile_photos
  for update
  using (uploaded_by_user_id = auth.uid())
  with check (uploaded_by_user_id = auth.uid());

drop policy if exists "Users can delete their own person profile photos"
  on public.person_profile_photos;
create policy "Users can delete their own person profile photos"
  on public.person_profile_photos
  for delete
  using (uploaded_by_user_id = auth.uid());

drop policy if exists "Users can view alternate names for editable people"
  on public.person_alternate_names;
create policy "Users can view alternate names for editable people"
  on public.person_alternate_names
  for select
  using (created_by_user_id = auth.uid());

drop policy if exists "Users can create alternate names for editable people"
  on public.person_alternate_names;
create policy "Users can create alternate names for editable people"
  on public.person_alternate_names
  for insert
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.people person
      where person.id = person_id
        and person.created_by_user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their alternate names"
  on public.person_alternate_names;
create policy "Users can update their alternate names"
  on public.person_alternate_names
  for update
  using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

drop policy if exists "Users can delete their alternate names"
  on public.person_alternate_names;
create policy "Users can delete their alternate names"
  on public.person_alternate_names
  for delete
  using (created_by_user_id = auth.uid());

drop policy if exists "Users can view life events for editable people"
  on public.person_life_events;
create policy "Users can view life events for editable people"
  on public.person_life_events
  for select
  using (created_by_user_id = auth.uid());

drop policy if exists "Users can create life events for editable people"
  on public.person_life_events;
create policy "Users can create life events for editable people"
  on public.person_life_events
  for insert
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.people person
      where person.id = person_id
        and person.created_by_user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their life events"
  on public.person_life_events;
create policy "Users can update their life events"
  on public.person_life_events
  for update
  using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

drop policy if exists "Users can delete their life events"
  on public.person_life_events;
create policy "Users can delete their life events"
  on public.person_life_events
  for delete
  using (created_by_user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('person-cover-photos', 'person-cover-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users can view their own person cover photos"
  on storage.objects;
create policy "Users can view their own person cover photos"
  on storage.objects
  for select
  using (
    bucket_id = 'person-cover-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own person cover photos"
  on storage.objects;
create policy "Users can upload their own person cover photos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'person-cover-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own person cover photos"
  on storage.objects;
create policy "Users can update their own person cover photos"
  on storage.objects
  for update
  using (
    bucket_id = 'person-cover-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'person-cover-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own person cover photos"
  on storage.objects;
create policy "Users can delete their own person cover photos"
  on storage.objects
  for delete
  using (
    bucket_id = 'person-cover-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
