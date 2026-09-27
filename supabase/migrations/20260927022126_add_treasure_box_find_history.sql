create or replace function public.get_my_treasure_box_find_history()
returns table(
  find_id uuid,
  cache_id uuid,
  nfc_public_token uuid,
  public_code text,
  title text,
  description text,
  found_at timestamptz,
  feedback_updated_at timestamptz,
  rating smallint,
  comment text,
  photo_paths text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    f.id,
    f.cache_id,
    coalesce(ptb.nfc_public_token, tag.public_token),
    c.public_code,
    c.title,
    c.description,
    f.found_at,
    f.updated_at,
    f.rating,
    f.comment,
    f.photo_paths
  from public.treasure_box_finds f
  join public.caches c on c.id = f.cache_id
  left join public.physical_treasure_boxes ptb
    on ptb.cache_id = f.cache_id
    and ptb.setup_status = 'published'
  left join lateral (
    select n.public_token
    from public.cache_nfc_tags n
    where n.cache_id = f.cache_id
      and n.status = 'active'
    order by n.created_at
    limit 1
  ) tag on true
  where f.user_id = auth.uid()
    and coalesce(ptb.nfc_public_token, tag.public_token) is not null
  order by f.found_at desc;
end;
$$;

revoke all on function public.get_my_treasure_box_find_history() from public, anon;
grant execute on function public.get_my_treasure_box_find_history() to authenticated;

create or replace function public.submit_treasure_box_feedback(
  p_public_token uuid,
  p_rating smallint,
  p_comment text default null,
  p_photo_paths text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cache_id uuid;
  v_find_id uuid;
  v_path text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if coalesce(array_length(p_photo_paths, 1), 0) > 5 then raise exception 'A maximum of 5 photos is allowed'; end if;

  foreach v_path in array coalesce(p_photo_paths, '{}') loop
    if v_path not like auth.uid()::text || '/%' then
      raise exception 'Invalid photo path';
    end if;
  end loop;

  select c.id into v_cache_id
  from public.cache_nfc_tags n
  join public.caches c on c.id = n.cache_id
  where n.public_token = p_public_token
    and n.status = 'active'
    and c.status = 'active'
  limit 1;

  if v_cache_id is null then raise exception 'Treasure Box not found'; end if;

  select f.id into v_find_id
  from public.treasure_box_finds f
  where f.cache_id = v_cache_id
    and f.user_id = auth.uid()
  for update;

  if v_find_id is null then
    raise exception 'Find this Treasure Box before adding to its Trail Log';
  end if;

  update public.treasure_box_finds f
  set rating = p_rating,
      comment = nullif(trim(p_comment), ''),
      photo_paths = coalesce(p_photo_paths, '{}'),
      updated_at = now()
  where f.id = v_find_id;

  delete from public.gallery_media gm
  where gm.user_id = auth.uid()
    and gm.source_type = 'trailhead_find'
    and gm.source_id = v_find_id
    and not (gm.storage_path = any(coalesce(p_photo_paths, '{}')));

  foreach v_path in array coalesce(p_photo_paths, '{}') loop
    insert into public.gallery_media(
      user_id, storage_bucket, storage_path, file_name,
      source_type, source_id, treasure_box_id
    )
    values (
      auth.uid(), 'trail-log-images', v_path,
      regexp_replace(v_path, '^.*/', ''),
      'trailhead_find', v_find_id, v_cache_id
    )
    on conflict (user_id, source_type, source_id, storage_path) do nothing;
  end loop;
end;
$$;

create or replace function public.submit_treasure_box_feedback(
  p_public_token uuid,
  p_rating smallint,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo_paths text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select f.photo_paths into v_photo_paths
  from public.treasure_box_finds f
  join public.cache_nfc_tags n on n.cache_id = f.cache_id
  where n.public_token = p_public_token
    and n.status = 'active'
    and f.user_id = auth.uid()
  limit 1;

  if v_photo_paths is null then
    raise exception 'Find this Treasure Box before adding to its Trail Log';
  end if;

  perform public.submit_treasure_box_feedback(
    p_public_token,
    p_rating,
    p_comment,
    v_photo_paths
  );
end;
$$;

revoke all on function public.submit_treasure_box_feedback(uuid, smallint, text, text[]) from public, anon;
grant execute on function public.submit_treasure_box_feedback(uuid, smallint, text, text[]) to authenticated;
revoke all on function public.submit_treasure_box_feedback(uuid, smallint, text) from public, anon;
grant execute on function public.submit_treasure_box_feedback(uuid, smallint, text) to authenticated;
