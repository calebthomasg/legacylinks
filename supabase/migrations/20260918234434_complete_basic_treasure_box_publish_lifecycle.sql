alter table public.physical_treasure_boxes
  add column if not exists nfc_verified_at timestamptz;

create or replace function public.start_claimed_treasure_box_setup(p_nfc_public_token uuid)
returns table(
  physical_box_id uuid, box_id text, cache_id uuid, experience_id uuid,
  title text, description text, difficulty smallint, terrain smallint,
  latitude double precision, longitude double precision, search_radius_meters integer,
  setup_status text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_box public.physical_treasure_boxes%rowtype;
  v_cache_id uuid;
  v_experience_id uuid;
  v_adventure_id uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select ptb.* into v_box
  from public.physical_treasure_boxes ptb
  where ptb.nfc_public_token=p_nfc_public_token and ptb.owner_id=auth.uid()
  for update;

  if v_box.id is null then raise exception 'Treasure Box not found or not owned by you'; end if;
  if v_box.claim_status <> 'claimed' then raise exception 'Treasure Box is not available for setup'; end if;

  v_cache_id:=v_box.cache_id;
  v_experience_id:=v_box.experience_id;

  if v_cache_id is null then
    insert into public.adventures(creator_id,title,slug,summary,status,is_official)
    values(
      auth.uid(),
      'Treasure Box '||v_box.serial_code,
      'treasure-box-'||lower(replace(v_box.serial_code,'LL-TB-',''))||'-'||substr(v_box.id::text,1,8),
      'Single Treasure Box',
      'draft',
      false
    ) returning id into v_adventure_id;

    v_code:='LL-C-'||replace(v_box.serial_code,'LL-TB-','TB-');

    insert into public.caches(
      adventure_id,creator_id,owner_id,public_code,title,description,difficulty,terrain,status,lifecycle_status
    ) values(
      v_adventure_id,auth.uid(),auth.uid(),v_code,'Untitled Treasure Box',null,1,1,'draft','draft'
    ) returning id into v_cache_id;

    update public.physical_treasure_boxes
    set cache_id=v_cache_id,updated_at=now()
    where id=v_box.id;
  else
    select c.adventure_id into v_adventure_id from public.caches c where c.id=v_cache_id;
  end if;

  if v_experience_id is null then
    select pe.id into v_experience_id
    from public.physical_experiences pe
    where pe.cache_id=v_cache_id
    limit 1;

    if v_experience_id is null then
      insert into public.physical_experiences(
        experience_type,creator_id,owner_id,cache_id,title,description,visibility,status
      ) values(
        'treasure_box',auth.uid(),auth.uid(),v_cache_id,'Untitled Treasure Box',null,'hidden','draft'
      ) returning id into v_experience_id;
    end if;

    update public.physical_treasure_boxes
    set experience_id=v_experience_id,updated_at=now()
    where id=v_box.id;
  end if;

  insert into public.physical_nfc_tags(experience_id,public_token,status)
  values(v_experience_id,p_nfc_public_token,'active')
  on conflict(public_token) do nothing;

  insert into public.cache_nfc_tags(cache_id,public_token,status)
  values(v_cache_id,p_nfc_public_token,'active')
  on conflict(public_token) do nothing;

  return query
  select
    v_box.id,
    v_box.serial_code,
    c.id,
    v_experience_id,
    c.title,
    c.description,
    c.difficulty,
    c.terrain,
    case
      when pl.exact_location is not null then gis.ST_Y(pl.exact_location::gis.geometry)
      when sa.search_center is not null then gis.ST_Y(sa.search_center::gis.geometry)
      else null
    end,
    case
      when pl.exact_location is not null then gis.ST_X(pl.exact_location::gis.geometry)
      when sa.search_center is not null then gis.ST_X(sa.search_center::gis.geometry)
      else null
    end,
    sa.search_radius_meters,
    (select ptb.setup_status from public.physical_treasure_boxes ptb where ptb.id=v_box.id)
  from public.caches c
  left join public.cache_search_areas sa on sa.cache_id=c.id
  left join private.cache_private_locations pl on pl.cache_id=c.id
  where c.id=v_cache_id;
end;
$$;

revoke all on function public.start_claimed_treasure_box_setup(uuid) from public, anon;
grant execute on function public.start_claimed_treasure_box_setup(uuid) to authenticated;

create or replace function public.save_claimed_treasure_box_setup(
  p_nfc_public_token uuid,
  p_title text,
  p_description text,
  p_difficulty integer,
  p_terrain integer,
  p_latitude double precision,
  p_longitude double precision,
  p_search_radius_meters integer default 75
)
returns table(cache_id uuid, experience_id uuid, setup_status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_box public.physical_treasure_boxes%rowtype;
  v_experience_id uuid;
  v_exact gis.geography;
  v_public_center gis.geography;
  v_bearing double precision;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_title,'')))=0 then raise exception 'Give your Treasure Box a name'; end if;
  if p_difficulty not between 1 and 5 or p_terrain not between 1 and 5 then
    raise exception 'Difficulty and terrain must be between 1 and 5';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Enter a valid location';
  end if;
  if p_search_radius_meters not between 10 and 1000 then
    raise exception 'Search radius must be between 10 and 1000 meters';
  end if;

  select ptb.* into v_box
  from public.physical_treasure_boxes ptb
  where ptb.nfc_public_token=p_nfc_public_token and ptb.owner_id=auth.uid()
  for update;

  if v_box.id is null or v_box.cache_id is null then
    raise exception 'Start Treasure Box setup first';
  end if;

  v_experience_id:=v_box.experience_id;
  v_exact:=gis.ST_SetSRID(gis.ST_MakePoint(p_longitude,p_latitude),4326)::gis.geography;
  v_bearing:=(get_byte(decode(md5(v_box.cache_id::text),'hex'),0)::double precision/255.0)*(2*pi());
  v_public_center:=gis.ST_Project(v_exact,p_search_radius_meters::double precision*0.40,v_bearing);

  update public.caches c
  set title=trim(p_title),
      description=nullif(trim(coalesce(p_description,'')),''),
      difficulty=p_difficulty::smallint,
      terrain=p_terrain::smallint,
      lifecycle_status='ready_to_place',
      updated_at=now()
  where c.id=v_box.cache_id and coalesce(c.owner_id,c.creator_id)=auth.uid();

  insert into private.cache_private_locations(cache_id,exact_location,placed_at,updated_at)
  values(v_box.cache_id,v_exact,now(),now())
  on conflict(cache_id) do update
  set exact_location=excluded.exact_location,
      placed_at=excluded.placed_at,
      updated_at=now();

  insert into public.cache_search_areas(cache_id,search_center,search_radius_meters,arrival_location)
  values(v_box.cache_id,v_public_center,p_search_radius_meters,v_public_center)
  on conflict on constraint cache_search_areas_pkey do update
  set search_center=excluded.search_center,
      search_radius_meters=excluded.search_radius_meters,
      arrival_location=excluded.arrival_location,
      updated_at=now();

  update public.physical_experiences pe
  set title=trim(p_title),
      description=nullif(trim(coalesce(p_description,'')),''),
      updated_at=now()
  where pe.id=v_experience_id and coalesce(pe.owner_id,pe.creator_id)=auth.uid();

  insert into public.physical_experience_locations(
    experience_id,latitude,longitude,search_radius_meters,exact_location_is_public
  ) values(
    v_experience_id,
    gis.ST_Y(v_public_center::gis.geometry),
    gis.ST_X(v_public_center::gis.geometry),
    p_search_radius_meters,
    false
  )
  on conflict on constraint physical_experience_locations_pkey do update
  set latitude=excluded.latitude,
      longitude=excluded.longitude,
      search_radius_meters=excluded.search_radius_meters,
      exact_location_is_public=false,
      updated_at=now();

  update public.physical_treasure_boxes ptb
  set setup_status='ready_to_publish',updated_at=now()
  where ptb.id=v_box.id;

  return query select v_box.cache_id,v_experience_id,'ready_to_publish'::text;
end;
$$;

revoke all on function public.save_claimed_treasure_box_setup(uuid,text,text,integer,integer,double precision,double precision,integer) from public, anon;
grant execute on function public.save_claimed_treasure_box_setup(uuid,text,text,integer,integer,double precision,double precision,integer) to authenticated;

create or replace function public.get_owned_treasure_box_review(p_nfc_public_token uuid)
returns table(
  box_id text, cache_id uuid, title text, description text,
  difficulty smallint, terrain smallint,
  latitude double precision, longitude double precision,
  search_radius_meters integer, setup_status text,
  content_options text[], publishable boolean, nfc_verified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ptb.serial_code,
    c.id,
    c.title,
    c.description,
    c.difficulty,
    c.terrain,
    gis.ST_Y(pl.exact_location::gis.geometry),
    gis.ST_X(pl.exact_location::gis.geometry),
    sa.search_radius_meters,
    ptb.setup_status,
    ptb.content_options,
    (
      ptb.claim_status='claimed'
      and c.title <> 'Untitled Treasure Box'
      and length(trim(c.title)) > 0
      and pl.exact_location is not null
      and sa.search_center is not null
      and ptb.experience_id is not null
    ),
    ptb.nfc_verified_at
  from public.physical_treasure_boxes ptb
  join public.caches c on c.id=ptb.cache_id
  join public.cache_search_areas sa on sa.cache_id=c.id
  join private.cache_private_locations pl on pl.cache_id=c.id
  where ptb.nfc_public_token=p_nfc_public_token and ptb.owner_id=auth.uid()
  limit 1;
$$;

revoke all on function public.get_owned_treasure_box_review(uuid) from public, anon;
grant execute on function public.get_owned_treasure_box_review(uuid) to authenticated;

create or replace function public.publish_claimed_treasure_box(p_nfc_public_token uuid)
returns table(box_id text, cache_id uuid, setup_status text, published_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_box public.physical_treasure_boxes%rowtype;
  v_cache public.caches%rowtype;
  v_published_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select ptb.* into v_box
  from public.physical_treasure_boxes ptb
  where ptb.nfc_public_token=p_nfc_public_token and ptb.owner_id=auth.uid()
  for update;

  if v_box.id is null then raise exception 'Treasure Box not found or not owned by you'; end if;
  if v_box.claim_status <> 'claimed' then raise exception 'Treasure Box is not available to publish'; end if;
  if v_box.cache_id is null or v_box.experience_id is null then raise exception 'Finish Treasure Box setup first'; end if;

  select * into v_cache from public.caches where id=v_box.cache_id;
  if v_cache.id is null then raise exception 'Treasure Box setup is incomplete'; end if;
  if v_cache.title='Untitled Treasure Box' or length(trim(v_cache.title))=0 then raise exception 'Give your Treasure Box a name'; end if;
  if not exists(select 1 from private.cache_private_locations pl where pl.cache_id=v_cache.id) then
    raise exception 'Confirm the physical placement before publishing';
  end if;
  if not exists(select 1 from public.cache_search_areas sa where sa.cache_id=v_cache.id) then
    raise exception 'Treasure Box search area is missing';
  end if;

  v_published_at:=coalesce(v_cache.published_at,now());

  update public.adventures
  set status='published',updated_at=now()
  where id=v_cache.adventure_id and creator_id=auth.uid();

  update public.caches
  set status='active',
      lifecycle_status='published',
      published_at=v_published_at,
      updated_at=now()
  where id=v_cache.id and coalesce(owner_id,creator_id)=auth.uid();

  update public.physical_experiences
  set status='published',visibility='public',updated_at=now()
  where id=v_box.experience_id and coalesce(owner_id,creator_id)=auth.uid();

  update public.physical_treasure_boxes
  set setup_status='published',updated_at=now()
  where id=v_box.id;

  return query select v_box.serial_code,v_cache.id,'published'::text,v_published_at;
end;
$$;

revoke all on function public.publish_claimed_treasure_box(uuid) from public, anon;
grant execute on function public.publish_claimed_treasure_box(uuid) to authenticated;

create or replace function public.verify_published_treasure_box_nfc(p_nfc_public_token uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verified_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  update public.physical_treasure_boxes ptb
  set nfc_verified_at=coalesce(ptb.nfc_verified_at,now()),updated_at=now()
  where ptb.nfc_public_token=p_nfc_public_token
    and ptb.owner_id=auth.uid()
    and ptb.claim_status='claimed'
    and ptb.setup_status='published'
  returning ptb.nfc_verified_at into v_verified_at;

  if v_verified_at is null then
    raise exception 'Published Treasure Box not found or not owned by you';
  end if;

  return v_verified_at;
end;
$$;

revoke all on function public.verify_published_treasure_box_nfc(uuid) from public, anon;
grant execute on function public.verify_published_treasure_box_nfc(uuid) to authenticated;

create or replace function public.get_physical_nfc_experience(p_public_token uuid)
returns table(experience_id uuid, experience_type text, title text, description text, status text, visibility text)
language sql
stable
security definer
set search_path = ''
as $$
  select pe.id,pe.experience_type,pe.title,pe.description,pe.status,pe.visibility
  from public.physical_nfc_tags tag
  join public.physical_experiences pe on pe.id=tag.experience_id
  where tag.public_token=p_public_token
    and tag.status='active'
    and pe.status='published'
    and pe.visibility='public'
  limit 1;
$$;

create or replace function public.record_physical_nfc_scan(p_public_token uuid)
returns table(event_id uuid, experience_id uuid, experience_type text, title text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.physical_nfc_tags%rowtype;
  v_experience public.physical_experiences%rowtype;
  v_event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_tag
  from public.physical_nfc_tags
  where public_token=p_public_token and status='active'
  limit 1;

  if v_tag.id is null then raise exception 'Physical NFC tag not found or inactive'; end if;

  select * into v_experience
  from public.physical_experiences
  where id=v_tag.experience_id and status='published' and visibility='public'
  limit 1;

  if v_experience.id is null then raise exception 'Physical experience is unavailable'; end if;

  insert into public.physical_discovery_events(user_id,experience_id,nfc_tag_id,event_type,verification_method)
  values(auth.uid(),v_experience.id,v_tag.id,'nfc_scan','nfc_token')
  returning id into v_event_id;

  return query select v_event_id,v_experience.id,v_experience.experience_type,v_experience.title;
end;
$$;

create or replace function public.admin_reset_designated_test_treasure_box(p_box_id text,p_confirmation text)
returns table(box_id text, activation_pin text, nfc_public_token uuid, nfc_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_box public.physical_treasure_boxes%rowtype;
  v_pin text;
  v_adventure_id uuid;
begin
  if not public.is_legacy_link_super_admin() then raise exception 'Super admin access required'; end if;

  select * into v_box
  from public.physical_treasure_boxes
  where serial_code=upper(trim(p_box_id))
  for update;

  if v_box.id is null then raise exception 'Treasure Box not found'; end if;
  if v_box.serial_code not in ('LL-TB-000004','LL-TB-000007') then
    raise exception 'Only designated physical test boxes can use this reset';
  end if;
  if trim(coalesce(p_confirmation,'')) <> 'RESET '||v_box.serial_code then
    raise exception 'Confirmation must exactly match RESET %',v_box.serial_code;
  end if;
  if exists(
    select 1 from public.traveling_tokens tt
    where tt.current_box_id=v_box.id and tt.status in ('in_circulation','in_transit')
  ) then
    raise exception 'This Treasure Box currently contains an active Traveling Token';
  end if;

  if v_box.cache_id is not null then
    select c.adventure_id into v_adventure_id from public.caches c where c.id=v_box.cache_id;
    delete from public.caches where id=v_box.cache_id;
    if v_adventure_id is not null
       and not exists(select 1 from public.caches c where c.adventure_id=v_adventure_id) then
      delete from public.adventures where id=v_adventure_id;
    end if;
  end if;

  v_pin:=public.generate_treasure_box_activation_pin();

  update public.physical_treasure_boxes
  set owner_id=null,
      cache_id=null,
      experience_id=null,
      claim_status='unclaimed',
      claimed_at=null,
      setup_status='not_started',
      content_options='{}'::text[],
      activation_pin_hash=public.hash_treasure_box_activation_pin(v_pin),
      activation_pin_last4=right(v_pin,4),
      pin_generated_at=now(),
      pin_consumed_at=null,
      nfc_verified_at=null,
      updated_at=now()
  where id=v_box.id;

  return query select v_box.serial_code,v_pin,v_box.nfc_public_token,'/n/'||v_box.nfc_public_token::text;
end;
$$;

revoke all on function public.admin_reset_designated_test_treasure_box(text,text) from public, anon;
grant execute on function public.admin_reset_designated_test_treasure_box(text,text) to authenticated;
