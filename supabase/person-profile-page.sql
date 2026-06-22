alter table public.people
  add column if not exists sex text,
  add column if not exists birth_place text,
  add column if not exists death_place text,
  add column if not exists burial_date date,
  add column if not exists burial_place text,
  add column if not exists christening_date date,
  add column if not exists christening_place text,
  add column if not exists baptism_date date,
  add column if not exists baptism_place text;

create table if not exists public.person_documents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  uploaded_by_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  document_name text not null,
  document_category text not null,
  document_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists people_linked_user_id_idx
  on public.people(linked_user_id);

create index if not exists people_created_by_user_id_idx
  on public.people(created_by_user_id);

create index if not exists family_relationships_person_id_idx
  on public.family_relationships(person_id);

create index if not exists family_relationships_related_person_id_idx
  on public.family_relationships(related_person_id);

create index if not exists journal_entry_people_person_id_idx
  on public.journal_entry_people(person_id);

create index if not exists person_documents_person_id_idx
  on public.person_documents(person_id);

create index if not exists person_documents_uploaded_by_user_id_idx
  on public.person_documents(uploaded_by_user_id);

alter table public.person_documents enable row level security;

drop policy if exists "Users can view their own person documents"
  on public.person_documents;
create policy "Users can view their own person documents"
  on public.person_documents
  for select
  using (uploaded_by_user_id = auth.uid());

drop policy if exists "Users can create their own person documents"
  on public.person_documents;
create policy "Users can create their own person documents"
  on public.person_documents
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

drop policy if exists "Users can update their own person documents"
  on public.person_documents;
create policy "Users can update their own person documents"
  on public.person_documents
  for update
  using (uploaded_by_user_id = auth.uid())
  with check (uploaded_by_user_id = auth.uid());

drop policy if exists "Users can delete their own person documents"
  on public.person_documents;
create policy "Users can delete their own person documents"
  on public.person_documents
  for delete
  using (uploaded_by_user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('person-documents', 'person-documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can view their own person documents"
  on storage.objects;
create policy "Users can view their own person documents"
  on storage.objects
  for select
  using (
    bucket_id = 'person-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own person documents"
  on storage.objects;
create policy "Users can upload their own person documents"
  on storage.objects
  for insert
  with check (
    bucket_id = 'person-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own person documents"
  on storage.objects;
create policy "Users can update their own person documents"
  on storage.objects
  for update
  using (
    bucket_id = 'person-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'person-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own person documents"
  on storage.objects;
create policy "Users can delete their own person documents"
  on storage.objects
  for delete
  using (
    bucket_id = 'person-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
