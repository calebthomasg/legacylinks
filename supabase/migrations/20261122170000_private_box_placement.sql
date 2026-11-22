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

  if v_box.setup_status='published' then raise exception 'Use the published box editor'; end if;
  v_experience_id:=v_box.experience_id;
  v_exact:=gis.ST_SetSRID(gis.ST_MakePoint(p_longitude,p_latitude),4326)::gis.geography;
  -- Retain the public center for an unchanged placement. New positions use a private random offset.
  select a.search_center into v_public_center
    from public.cache_search_areas a join private.cache_private_locations l using(cache_id)
    where a.cache_id=v_box.cache_id and gis.ST_Equals(l.exact_location::gis.geometry,v_exact::gis.geometry)
      and gis.ST_DWithin(v_exact,a.search_center,p_search_radius_meters::double precision)
      and not gis.ST_Equals(v_exact::gis.geometry,a.search_center::gis.geometry);
  if v_public_center is null then
    v_public_center:=gis.ST_Project(v_exact,p_search_radius_meters::double precision*(0.25+random()*0.4),random()*2*pi());
  end if;

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
