create or replace function public.save_claimed_treasure_box_setup(p_nfc_public_token uuid,p_title text,p_description text,p_difficulty integer,p_terrain integer,p_latitude double precision,p_longitude double precision,p_search_radius_meters integer default 75)
returns table(cache_id uuid,experience_id uuid,setup_status text)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare v_box public.physical_treasure_boxes%rowtype; v_experience_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_title,'')))=0 then raise exception 'Give your Treasure Box a name'; end if;
 if p_difficulty not between 1 and 5 or p_terrain not between 1 and 5 then raise exception 'Difficulty and terrain must be between 1 and 5'; end if;
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Enter a valid location'; end if;
 if p_search_radius_meters not between 10 and 1000 then raise exception 'Search radius must be between 10 and 1000 meters'; end if;
 select ptb.* into v_box from public.physical_treasure_boxes as ptb where ptb.nfc_public_token=p_nfc_public_token and ptb.owner_id=auth.uid() for update;
 if v_box.id is null or v_box.cache_id is null then raise exception 'Start Treasure Box setup first'; end if;
 v_experience_id:=v_box.experience_id;
 update public.caches as c set title=trim(p_title),description=nullif(trim(coalesce(p_description,'')),''),difficulty=p_difficulty::smallint,terrain=p_terrain::smallint,updated_at=now() where c.id=v_box.cache_id and coalesce(c.owner_id,c.creator_id)=auth.uid();
 insert into public.cache_search_areas(cache_id,search_center,search_radius_meters,arrival_location) values(v_box.cache_id,gis.ST_SetSRID(gis.ST_MakePoint(p_longitude,p_latitude),4326)::gis.geography,p_search_radius_meters,gis.ST_SetSRID(gis.ST_MakePoint(p_longitude,p_latitude),4326)::gis.geography) on conflict on constraint cache_search_areas_pkey do update set search_center=excluded.search_center,search_radius_meters=excluded.search_radius_meters,arrival_location=excluded.arrival_location,updated_at=now();
 update public.physical_experiences as pe set title=trim(p_title),description=nullif(trim(coalesce(p_description,'')),''),updated_at=now() where pe.id=v_experience_id and coalesce(pe.owner_id,pe.creator_id)=auth.uid();
 insert into public.physical_experience_locations(experience_id,latitude,longitude,search_radius_meters,exact_location_is_public) values(v_experience_id,p_latitude,p_longitude,p_search_radius_meters,false) on conflict on constraint physical_experience_locations_pkey do update set latitude=excluded.latitude,longitude=excluded.longitude,search_radius_meters=excluded.search_radius_meters,exact_location_is_public=false,updated_at=now();
 update public.physical_treasure_boxes as ptb set setup_status='in_progress',updated_at=now() where ptb.id=v_box.id;
 return query select v_box.cache_id,v_experience_id,'in_progress'::text;
end;$$;