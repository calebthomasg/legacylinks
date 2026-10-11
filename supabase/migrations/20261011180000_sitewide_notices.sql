create table public.sitewide_notices (
 id uuid primary key default gen_random_uuid(),
 category text not null check (category in ('fix','feature','maintenance','announcement','important')),
 headline text not null check (char_length(trim(headline)) between 1 and 120),
 description text not null check (char_length(trim(description)) between 1 and 2000),
 button_text text not null default 'Got it' check (char_length(trim(button_text)) between 1 and 60),
 status text not null default 'draft' check (status in ('draft','published','inactive')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.sitewide_notices enable row level security;
create policy "Everyone can read published notices" on public.sitewide_notices for select to anon, authenticated using (status = 'published' or public.is_legacy_link_admin());
create policy "Administrators can create notices" on public.sitewide_notices for insert to authenticated with check (exists(select 1 from public.admin_users where user_id=auth.uid() and role in ('admin','super_admin')));
create policy "Administrators can update notices" on public.sitewide_notices for update to authenticated using (exists(select 1 from public.admin_users where user_id=auth.uid() and role in ('admin','super_admin'))) with check (exists(select 1 from public.admin_users where user_id=auth.uid() and role in ('admin','super_admin')));
grant select on public.sitewide_notices to anon, authenticated;
grant insert, update on public.sitewide_notices to authenticated;
create index sitewide_notices_published_idx on public.sitewide_notices (created_at desc) where status = 'published';
