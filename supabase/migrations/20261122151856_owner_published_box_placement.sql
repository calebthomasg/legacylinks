create function public.get_owned_published_box_placement(p_experience_id uuid)
returns table(latitude double precision, longitude double precision)
language sql stable security definer set search_path='' as $$
  select gis.ST_Y(l.exact_location::gis.geometry),gis.ST_X(l.exact_location::gis.geometry)
  from public.physical_treasure_boxes b join private.cache_private_locations l on l.cache_id=b.cache_id
  where b.experience_id=p_experience_id and b.owner_id=auth.uid()
    and b.claim_status='claimed' and b.setup_status='published';
$$;

create function public.move_owned_published_treasure_box(
  p_experience_id uuid, p_title text, p_description text, p_hint text, p_radius numeric,
  p_latitude double precision, p_longitude double precision,
  p_previous_latitude double precision, p_previous_longitude double precision
) returns void language plpgsql security definer set search_path='' as $$
declare
  box_cache uuid;
  old_pin gis.geography;
  new_pin gis.geography;
  public_center gis.geography;
  meters numeric;
begin
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90
      or p_longitude not between -180 and 180 then raise exception 'Invalid hiding spot'; end if;
  -- Checks the signed-in owner, claimed/published status, and locks the physical box.
  select m.cache_id into strict box_cache from public.update_published_treasure_box_metadata(
    p_experience_id,p_title,p_description) m;
  select l.exact_location,coalesce(p_radius,a.search_radius_meters) into strict old_pin,meters
    from private.cache_private_locations l join public.cache_search_areas a using(cache_id)
    where l.cache_id=box_cache for update of l,a;
  if gis.ST_Y(old_pin::gis.geometry) is distinct from p_previous_latitude or
     gis.ST_X(old_pin::gis.geometry) is distinct from p_previous_longitude then
    raise exception 'The hiding spot changed. Reopen the editor to review the latest placement.';
  end if;
  if meters not between 3.048 and 1609.344 then raise exception 'Invalid search radius'; end if;
  perform public.save_treasure_box_hint(box_cache,p_hint);
  new_pin:=gis.ST_SetSRID(gis.ST_MakePoint(p_longitude,p_latitude),4326)::gis.geography;
  public_center:=gis.ST_Project(new_pin,meters::double precision*(0.25+random()*0.4),random()*2*pi());
  update private.cache_private_locations set exact_location=new_pin,updated_at=now() where cache_id=box_cache;
  update public.cache_search_areas set search_center=public_center,arrival_location=public_center,
    search_radius_meters=meters,updated_at=now() where cache_id=box_cache;
  update public.physical_experience_locations set latitude=gis.ST_Y(public_center::gis.geometry),
    longitude=gis.ST_X(public_center::gis.geometry),search_radius_meters=meters,
    exact_location_is_public=false,updated_at=now() where experience_id=p_experience_id;
  if not found then raise exception 'Public search area is missing'; end if;
end;
$$;
revoke all on function public.get_owned_published_box_placement(uuid),
  public.move_owned_published_treasure_box(uuid,text,text,text,numeric,double precision,double precision,double precision,double precision)
  from public,anon;
grant execute on function public.get_owned_published_box_placement(uuid),
  public.move_owned_published_treasure_box(uuid,text,text,text,numeric,double precision,double precision,double precision,double precision)
  to authenticated;
