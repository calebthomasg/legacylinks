-- Website/backend foundation. The tables are internal until a reviewed service
-- implements verified guardian approval and server-side authorization.
create schema if not exists private;

create table private.trailblazer_identities (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  origin text not null check (origin in ('legacy_account', 'managed_child')),
  created_at timestamptz not null default now(),
  constraint legacy_trailblazer_keeps_account_id
    check (origin <> 'legacy_account' or auth_user_id is null or auth_user_id = id)
);

create table private.trailblazer_families (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table private.trailblazer_family_guardians (
  family_id uuid not null references private.trailblazer_families (id),
  guardian_id uuid not null references private.trailblazer_identities (id),
  added_at timestamptz not null default now(),
  revoked_at timestamptz check (revoked_at >= added_at),
  primary key (family_id, guardian_id)
);

create table private.trailblazer_managed_children (
  trailblazer_id uuid primary key references private.trailblazer_identities (id),
  family_id uuid not null references private.trailblazer_families (id),
  created_at timestamptz not null default now(),
  unique (family_id, trailblazer_id)
);

create table private.trailblazer_guardian_consents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  guardian_id uuid not null,
  purpose text not null check (btrim(purpose) <> ''),
  policy_version text not null check (btrim(policy_version) <> ''),
  verification_method text not null check (btrim(verification_method) <> ''),
  verification_provider text not null check (btrim(verification_provider) <> ''),
  verification_reference text not null check (btrim(verification_reference) <> ''),
  verified_at timestamptz not null,
  withdrawn_at timestamptz check (withdrawn_at >= verified_at),
  foreign key (family_id, child_id)
    references private.trailblazer_managed_children (family_id, trailblazer_id),
  foreign key (family_id, guardian_id)
    references private.trailblazer_family_guardians (family_id, guardian_id),
  check (child_id <> guardian_id),
  unique (verification_provider, verification_reference, purpose)
);

create unique index trailblazer_guardian_one_active_consent_per_purpose
  on private.trailblazer_guardian_consents (family_id, child_id, guardian_id, purpose)
  where withdrawn_at is null;

alter table private.trailblazer_identities enable row level security;
alter table private.trailblazer_families enable row level security;
alter table private.trailblazer_family_guardians enable row level security;
alter table private.trailblazer_managed_children enable row level security;
alter table private.trailblazer_guardian_consents enable row level security;

revoke all on table
  private.trailblazer_identities,
  private.trailblazer_families,
  private.trailblazer_family_guardians,
  private.trailblazer_managed_children,
  private.trailblazer_guardian_consents
from public, anon, authenticated, service_role;
