-- Secure NFC lookup used by the cache landing route.
-- The opaque public_token identifies an active NFC tag without exposing
-- cache_nfc_tags or private cache location data to browser clients.
-- Public visitors receive preview metadata only. Authenticated users also
-- receive the cache backstory so the story can be revealed after sign-in.

drop function if exists public.resolve_cache_nfc(uuid);

create function public.resolve_cache_nfc(p_public_token uuid)
returns table (
  cache_id uuid,
  public_code text,
  title text,
  description text,
  difficulty smallint,
  terrain smallint,
  backstory text
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
    c.terrain,
    case
      when auth.uid() is not null then c.backstory
      else null
    end as backstory
  from public.cache_nfc_tags n
  join public.caches c on c.id = n.cache_id
  where n.public_token = p_public_token
    and n.status = 'active'
    and c.status = 'active'
  limit 1;
$$;

revoke all on function public.resolve_cache_nfc(uuid) from public;
revoke execute on function public.resolve_cache_nfc(uuid) from anon, authenticated;
grant execute on function public.resolve_cache_nfc(uuid) to anon, authenticated;
