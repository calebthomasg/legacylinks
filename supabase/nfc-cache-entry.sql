-- Secure, minimal lookup used by the public NFC landing route.
-- The opaque public_token identifies an active NFC tag without exposing
-- cache_nfc_tags or private cache location data to browser clients.

create or replace function public.resolve_cache_nfc(p_public_token uuid)
returns table (
  cache_id uuid,
  public_code text,
  title text,
  description text,
  difficulty smallint,
  terrain smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.public_code,
    c.title,
    c.description,
    c.difficulty,
    c.terrain
  from public.cache_nfc_tags n
  join public.caches c on c.id = n.cache_id
  where n.public_token = p_public_token
    and n.status = 'active'
    and c.status = 'active'
  limit 1;
$$;

revoke all on function public.resolve_cache_nfc(uuid) from public;
grant execute on function public.resolve_cache_nfc(uuid) to anon, authenticated;
