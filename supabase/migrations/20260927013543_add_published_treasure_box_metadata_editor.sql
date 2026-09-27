create or replace function public.update_published_treasure_box_metadata(
  p_experience_id uuid,
  p_title text,
  p_description text default null
)
returns table(
  experience_id uuid,
  cache_id uuid,
  title text,
  description text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_box public.physical_treasure_boxes%rowtype;
  v_title text := trim(coalesce(p_title, ''));
  v_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_title = '' then
    raise exception 'Give your Treasure Box a name';
  end if;

  if length(v_title) > 160 then
    raise exception 'Treasure Box names must be 160 characters or fewer';
  end if;

  if length(coalesce(v_description, '')) > 4000 then
    raise exception 'Treasure Box descriptions must be 4000 characters or fewer';
  end if;

  select ptb.*
  into v_box
  from public.physical_treasure_boxes ptb
  where ptb.experience_id = p_experience_id
    and ptb.owner_id = auth.uid()
    and ptb.claim_status = 'claimed'
    and ptb.setup_status = 'published'
  for update;

  if v_box.id is null or v_box.cache_id is null then
    raise exception 'Published Treasure Box not found or not owned by you';
  end if;

  update public.caches c
  set title = v_title,
      description = v_description,
      updated_at = now()
  where c.id = v_box.cache_id;

  update public.physical_experiences pe
  set title = v_title,
      description = v_description,
      updated_at = now()
  where pe.id = v_box.experience_id
    and pe.experience_type = 'treasure_box';

  return query
  select v_box.experience_id, v_box.cache_id, v_title, v_description;
end;
$$;

revoke all on function public.update_published_treasure_box_metadata(uuid, text, text) from public, anon;
grant execute on function public.update_published_treasure_box_metadata(uuid, text, text) to authenticated;
