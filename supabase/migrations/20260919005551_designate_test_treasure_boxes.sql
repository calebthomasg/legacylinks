alter table public.physical_treasure_boxes
  add column if not exists inventory_environment text not null default 'production'
  check (inventory_environment in ('production','testing'));

update public.physical_treasure_boxes
set inventory_environment='testing',updated_at=now()
where serial_code in ('LL-TB-000004','LL-TB-000007');

drop function if exists public.list_admin_physical_items();

create function public.list_admin_physical_items()
returns table(
  item_type text,
  item_id text,
  status text,
  owner_full_name text,
  owner_id uuid,
  nfc_public_token uuid,
  nfc_path text,
  provisioned_at timestamptz,
  claimed_at timestamptz,
  item_environment text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    'Treasure Box'::text,
    b.serial_code,
    case
      when b.claim_status='unclaimed' then 'Unclaimed'
      when b.setup_status='published' then 'Published'
      when b.setup_status is not null then initcap(replace(b.setup_status,'_',' '))
      else initcap(replace(b.claim_status,'_',' '))
    end,
    nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),
    b.owner_id,
    b.nfc_public_token,
    '/n/'||b.nfc_public_token::text,
    b.provisioned_at,
    b.claimed_at,
    b.inventory_environment
  from public.physical_treasure_boxes b
  left join public.profiles p on p.id=b.owner_id
  where public.is_legacy_link_admin()

  union all

  select
    'Traveling Token'::text,
    t.token_code,
    initcap(replace(t.status,'_',' ')),
    nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),
    t.owner_id,
    t.nfc_public_token,
    '/t/'||t.nfc_public_token::text,
    t.provisioned_at,
    t.activated_at,
    'production'::text
  from public.traveling_tokens t
  left join public.profiles p on p.id=t.owner_id
  where public.is_legacy_link_admin()
  order by provisioned_at desc nulls last;
$$;

revoke all on function public.list_admin_physical_items() from public, anon;
grant execute on function public.list_admin_physical_items() to authenticated;
