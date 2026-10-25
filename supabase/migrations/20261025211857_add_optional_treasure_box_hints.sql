alter table public.caches add column if not exists hint text;

alter table public.caches add constraint caches_hint_length check (length(hint) <= 1000);

create function public.get_owned_treasure_box_hint(p_cache_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select c.hint
  from public.caches c
  join public.physical_treasure_boxes ptb on ptb.cache_id = c.id
  where c.id = p_cache_id and ptb.owner_id = auth.uid() and ptb.claim_status = 'claimed'
  limit 1;
$$;

revoke all on function public.get_owned_treasure_box_hint(uuid) from public, anon;
grant execute on function public.get_owned_treasure_box_hint(uuid) to authenticated;

create function public.save_treasure_box_hint(p_cache_id uuid, p_hint text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_hint text := nullif(trim(coalesce(p_hint, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(coalesce(v_hint, '')) > 1000 then raise exception 'Hints must be 1000 characters or fewer'; end if;

  update public.caches c
  set hint = v_hint, updated_at = now()
  from public.physical_treasure_boxes ptb
  where c.id = p_cache_id
    and ptb.cache_id = c.id
    and ptb.owner_id = auth.uid()
    and ptb.claim_status = 'claimed';

  if not found then raise exception 'Treasure Box not found or not owned by you'; end if;
  return v_hint;
end;
$$;

revoke all on function public.save_treasure_box_hint(uuid, text) from public, anon;
grant execute on function public.save_treasure_box_hint(uuid, text) to authenticated;

create function public.get_trailhead_box_details()
returns table(cache_id uuid, hint text, placer_first_name text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.hint, coalesce(nullif(trim(p.first_name), ''), 'a Trailblazer')
  from public.caches c
  join public.adventures a on a.id = c.adventure_id
  join public.cache_search_areas sa on sa.cache_id = c.id
  left join public.physical_treasure_boxes ptb on ptb.cache_id = c.id
  left join public.profiles p on p.id = coalesce(c.creator_id, ptb.owner_id, c.owner_id)
  where auth.uid() is not null
    and c.status = 'active'
    and a.status = 'published'
    and (coalesce(ptb.inventory_environment, 'production') = 'production' or public.is_legacy_link_admin());
$$;

revoke all on function public.get_trailhead_box_details() from public, anon;
grant execute on function public.get_trailhead_box_details() to authenticated;
