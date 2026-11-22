-- Widen both stored meter values and the RPCs that return them in one transaction.
alter table public.cache_search_areas drop constraint cache_search_areas_search_radius_meters_check,
  alter column search_radius_meters type numeric,
  alter column search_radius_meters set default 6.096,
  add constraint cache_search_areas_search_radius_meters_check check (search_radius_meters between 3.048 and 1609.344);
alter table public.physical_experience_locations alter column search_radius_meters type numeric;

drop function public.get_my_treasure();
CREATE OR REPLACE FUNCTION public.get_my_treasure()
 RETURNS TABLE(experience_id uuid, experience_type text, cache_id uuid, title text, description text, lifecycle_status text, created_at timestamp with time zone, latitude double precision, longitude double precision, search_radius_meters numeric, marker_variant text, unique_find_count bigint, average_rating numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with treasure_boxes as (
    select
      pe.id as experience_id,
      'treasure_box'::text as experience_type,
      c.id as cache_id,
      c.title,
      c.description,
      c.lifecycle_status,
      c.created_at,
      case when sa.search_center is null then null else gis.ST_Y(sa.search_center::gis.geometry) end as latitude,
      case when sa.search_center is null then null else gis.ST_X(sa.search_center::gis.geometry) end as longitude,
      sa.search_radius_meters,
      'treasure_box'::text as marker_variant,
      coalesce(stats.find_count, 0)::bigint as unique_find_count,
      stats.avg_rating as average_rating
    from public.caches c
    join public.physical_experiences pe on pe.cache_id = c.id and pe.experience_type = 'treasure_box'
    left join public.cache_search_areas sa on sa.cache_id = c.id
    left join lateral (
      select count(*) as find_count, round(avg(f.rating)::numeric, 1) as avg_rating
      from public.treasure_box_finds f
      where f.cache_id = c.id
    ) stats on true
    where coalesce(pe.owner_id, pe.creator_id, c.owner_id, c.creator_id) = auth.uid()
  ),
  other_treasure as (
    select
      pe.id as experience_id,
      pe.experience_type,
      pe.cache_id,
      pe.title,
      pe.description,
      pe.status as lifecycle_status,
      pe.created_at,
      pel.latitude,
      pel.longitude,
      pel.search_radius_meters,
      case when pe.experience_type = 'memorial' then 'memorial' else 'token' end as marker_variant,
      0::bigint as unique_find_count,
      null::numeric as average_rating
    from public.physical_experiences pe
    left join public.physical_experience_locations pel on pel.experience_id = pe.id
    where pe.experience_type in ('memorial','token_hunt')
      and coalesce(pe.owner_id, pe.creator_id) = auth.uid()
  )
  select * from treasure_boxes
  union all
  select * from other_treasure
  order by created_at desc;
$function$;
revoke all on function public.get_my_treasure() from public, anon, authenticated, service_role;
grant execute on function public.get_my_treasure() to PUBLIC,anon,authenticated,service_role;

drop function public.get_my_treasure_boxes();
CREATE OR REPLACE FUNCTION public.get_my_treasure_boxes()
 RETURNS TABLE(cache_id uuid, public_code text, title text, description text, difficulty smallint, terrain smallint, chapter_number integer, adventure_id uuid, adventure_title text, lifecycle_status text, created_at timestamp with time zone, search_latitude double precision, search_longitude double precision, search_radius_meters numeric, unique_find_count bigint, average_rating numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    c.id,
    c.public_code,
    c.title,
    c.description,
    c.difficulty,
    c.terrain,
    c.chapter_number,
    a.id,
    a.title,
    c.lifecycle_status,
    c.created_at,
    case when sa.search_center is null then null else gis.ST_Y(sa.search_center::gis.geometry) end,
    case when sa.search_center is null then null else gis.ST_X(sa.search_center::gis.geometry) end,
    sa.search_radius_meters,
    coalesce(stats.find_count,0),
    stats.avg_rating
  from public.caches c
  join public.adventures a on a.id=c.adventure_id
  left join public.cache_search_areas sa on sa.cache_id=c.id
  left join lateral (
    select count(*) as find_count, round(avg(f.rating)::numeric,1) as avg_rating
    from public.treasure_box_finds f where f.cache_id=c.id
  ) stats on true
  where coalesce(c.owner_id,c.creator_id)=auth.uid()
  order by c.updated_at desc, c.created_at desc;
$function$;
revoke all on function public.get_my_treasure_boxes() from public, anon, authenticated, service_role;
grant execute on function public.get_my_treasure_boxes() to PUBLIC,anon,authenticated,service_role;

drop function public.get_owned_treasure_box_review(p_nfc_public_token uuid);
CREATE OR REPLACE FUNCTION public.get_owned_treasure_box_review(p_nfc_public_token uuid)
 RETURNS TABLE(box_id text, cache_id uuid, title text, description text, difficulty smallint, terrain smallint, latitude double precision, longitude double precision, search_radius_meters numeric, setup_status text, content_options text[], publishable boolean, nfc_verified_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
revoke all on function public.get_owned_treasure_box_review(p_nfc_public_token uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_owned_treasure_box_review(p_nfc_public_token uuid) to authenticated,service_role;

drop function public.get_trailhead_caches();
CREATE OR REPLACE FUNCTION public.get_trailhead_caches()
 RETURNS TABLE(cache_id uuid, public_code text, title text, description text, difficulty smallint, terrain smallint, chapter_number integer, adventure_id uuid, adventure_title text, adventure_slug text, search_latitude double precision, search_longitude double precision, search_radius_meters numeric, arrival_latitude double precision, arrival_longitude double precision, created_at timestamp with time zone, unique_find_count bigint, average_rating numeric, recent_comments jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    c.id,
    c.public_code,
    c.title,
    c.description,
    c.difficulty,
    c.terrain,
    c.chapter_number,
    a.id,
    a.title,
    a.slug,
    gis.st_y(sa.search_center::gis.geometry),
    gis.st_x(sa.search_center::gis.geometry),
    sa.search_radius_meters,
    case when sa.arrival_location is null then null else gis.st_y(sa.arrival_location::gis.geometry) end,
    case when sa.arrival_location is null then null else gis.st_x(sa.arrival_location::gis.geometry) end,
    c.created_at,
    coalesce(stats.find_count,0),
    stats.avg_rating,
    coalesce(comments.items,'[]'::jsonb)
  from public.caches c
  join public.adventures a on a.id=c.adventure_id
  join public.cache_search_areas sa on sa.cache_id=c.id
  left join public.physical_treasure_boxes ptb on ptb.cache_id=c.id
  left join lateral (
    select count(*) as find_count,round(avg(f.rating)::numeric,1) as avg_rating
    from public.treasure_box_finds f
    where f.cache_id=c.id
  ) stats on true
  left join lateral (
    select jsonb_agg(x.item order by x.found_at desc) as items
    from (
      select
        jsonb_build_object(
          'first_name',coalesce(p.first_name,'Trailblazer'),
          'comment',f.comment,
          'rating',f.rating,
          'found_at',f.found_at,
          'photo_paths',f.photo_paths
        ) as item,
        f.found_at
      from public.treasure_box_finds f
      left join public.profiles p on p.id=f.user_id
      where f.cache_id=c.id
        and (f.comment is not null or cardinality(f.photo_paths)>0)
      order by f.found_at desc
      limit 10
    ) x
  ) comments on true
  where c.status='active'
    and a.status='published'
    and (
      coalesce(ptb.inventory_environment,'production')='production'
      or public.is_legacy_link_admin()
    )
  order by a.title,c.chapter_number nulls last,c.title;
$function$;
revoke all on function public.get_trailhead_caches() from public, anon, authenticated, service_role;
grant execute on function public.get_trailhead_caches() to authenticated,service_role;

drop function public.get_trailhead_discovery_items();
CREATE OR REPLACE FUNCTION public.get_trailhead_discovery_items()
 RETURNS TABLE(experience_id uuid, experience_type text, cache_id uuid, title text, description text, latitude double precision, longitude double precision, search_radius_meters numeric, marker_variant text, teaser_text text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with treasure_items as (
    select
      pe.id as experience_id,
      'treasure_box'::text as experience_type,
      c.id as cache_id,
      c.title,
      c.description,
      gis.st_y(sa.search_center::gis.geometry) as latitude,
      gis.st_x(sa.search_center::gis.geometry) as longitude,
      sa.search_radius_meters,
      'treasure_box'::text as marker_variant,
      case when exists (
        select 1
        from public.token_placements tp
        where tp.treasure_box_cache_id=c.id
          and tp.placement_visibility in ('teaser','public')
          and tp.discovered_at>=now()-interval '30 days'
      ) then 'A special token was found here recently.' else null end as teaser_text
    from public.physical_experiences pe
    join public.caches c on c.id=pe.cache_id
    join public.adventures a on a.id=c.adventure_id
    join public.cache_search_areas sa on sa.cache_id=c.id
    left join public.physical_treasure_boxes ptb on ptb.experience_id=pe.id
    where pe.experience_type='treasure_box'
      and pe.status='published'
      and pe.visibility='public'
      and c.status='active'
      and a.status='published'
      and (
        coalesce(ptb.inventory_environment,'production')='production'
        or public.is_legacy_link_admin()
      )
  ),
  generic_items as (
    select
      pe.id as experience_id,
      pe.experience_type,
      pe.cache_id,
      case when pe.experience_type='memorial' and linked.linked_title is not null
        then linked.linked_title else pe.title end as title,
      case when pe.experience_type='memorial' and linked.linked_description is not null
        then linked.linked_description else pe.description end as description,
      pel.latitude,
      pel.longitude,
      pel.search_radius_meters,
      case
        when pe.experience_type='memorial' then 'memorial'
        when pe.experience_type='token_hunt' then 'token'
        else pe.experience_type
      end as marker_variant,
      null::text as teaser_text
    from public.physical_experiences pe
    join public.physical_experience_locations pel on pel.experience_id=pe.id
    left join lateral (
      select
        string_agg(
          coalesce(nullif(trim(p.display_name),''),nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.first_name),
          ' & ' order by mp.sort_order,mp.created_at
        ) as linked_title,
        string_agg(
          nullif(trim(coalesce(p.profile_summary,p.bio)),''),
          E'\n\n' order by mp.sort_order,mp.created_at
        ) filter (where nullif(trim(coalesce(p.profile_summary,p.bio)),'') is not null) as linked_description
      from public.memorial_people mp
      join public.people p on p.id=mp.person_id
      where mp.experience_id=pe.id
    ) linked on pe.experience_type='memorial'
    where pe.experience_type in ('memorial','token_hunt')
      and pe.status='published'
      and pe.visibility='public'
  )
  select * from treasure_items
  union all
  select * from generic_items
  order by title;
$function$;
revoke all on function public.get_trailhead_discovery_items() from public, anon, authenticated, service_role;
grant execute on function public.get_trailhead_discovery_items() to authenticated,service_role;

drop function public.save_claimed_treasure_box_setup(p_nfc_public_token uuid, p_title text, p_description text, p_difficulty integer, p_terrain integer, p_latitude double precision, p_longitude double precision, p_search_radius_meters integer);
CREATE OR REPLACE FUNCTION public.save_claimed_treasure_box_setup(p_nfc_public_token uuid, p_title text, p_description text, p_difficulty integer, p_terrain integer, p_latitude double precision, p_longitude double precision, p_search_radius_meters numeric DEFAULT 6.096)
 RETURNS TABLE(cache_id uuid, experience_id uuid, setup_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if p_search_radius_meters is null or p_search_radius_meters not between 3.048 and 1609.344 then
    raise exception 'Search radius must be between 3.048 and 1609.344 meters';
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
  on conflict on constraint cache_private_locations_pkey do update
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
$function$;
revoke all on function public.save_claimed_treasure_box_setup(p_nfc_public_token uuid, p_title text, p_description text, p_difficulty integer, p_terrain integer, p_latitude double precision, p_longitude double precision, p_search_radius_meters numeric) from public, anon, authenticated, service_role;
grant execute on function public.save_claimed_treasure_box_setup(p_nfc_public_token uuid, p_title text, p_description text, p_difficulty integer, p_terrain integer, p_latitude double precision, p_longitude double precision, p_search_radius_meters numeric) to authenticated,service_role;

drop function public.start_claimed_treasure_box_setup(p_nfc_public_token uuid);
CREATE OR REPLACE FUNCTION public.start_claimed_treasure_box_setup(p_nfc_public_token uuid)
 RETURNS TABLE(physical_box_id uuid, box_id text, cache_id uuid, experience_id uuid, title text, description text, difficulty smallint, terrain smallint, latitude double precision, longitude double precision, search_radius_meters numeric, setup_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
revoke all on function public.start_claimed_treasure_box_setup(p_nfc_public_token uuid) from public, anon, authenticated, service_role;
grant execute on function public.start_claimed_treasure_box_setup(p_nfc_public_token uuid) to authenticated,service_role;

-- Metadata, hint, and optional radius are one owner-authorized edit.
create function public.edit_published_treasure_box(
  p_experience_id uuid, p_title text, p_description text, p_hint text, p_radius numeric
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cache_id uuid;
  v_exact gis.geography;
  v_center gis.geography;
begin
  select m.cache_id into strict v_cache_id
    from public.update_published_treasure_box_metadata(p_experience_id,p_title,p_description) m;
  perform public.save_treasure_box_hint(v_cache_id,p_hint);
  if p_radius is null then return; end if;
  if p_radius not between 3.048 and 1609.344 then raise exception 'Invalid search radius'; end if;
  select l.exact_location, a.search_center into strict v_exact, v_center
    from private.cache_private_locations l join public.cache_search_areas a using (cache_id)
    where l.cache_id=v_cache_id for update of a;
  if v_exact is null then raise exception 'Private placement is missing'; end if;
  -- Keep the public area when it still covers the box. Move it only when necessary.
  if v_center is null or not gis.ST_DWithin(v_exact,v_center,p_radius::double precision) then
    v_center := gis.ST_Project(v_exact, p_radius::double precision * 0.4, random() * 2 * pi());
  end if;
  update public.cache_search_areas set search_center=v_center, arrival_location=v_center,
    search_radius_meters=p_radius, updated_at=now() where cache_id=v_cache_id;
  update public.physical_experience_locations set latitude=gis.ST_Y(v_center::gis.geometry),
    longitude=gis.ST_X(v_center::gis.geometry),search_radius_meters=p_radius,updated_at=now()
    where experience_id=p_experience_id;
  if not found then raise exception 'Public placement is missing'; end if;
end;
$$;
revoke all on function public.edit_published_treasure_box(uuid,text,text,text,numeric) from public,anon;
grant execute on function public.edit_published_treasure_box(uuid,text,text,text,numeric) to authenticated;
