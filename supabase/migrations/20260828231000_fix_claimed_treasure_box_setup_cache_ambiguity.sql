create or replace function public.start_claimed_treasure_box_setup(p_nfc_public_token uuid)
returns table(physical_box_id uuid,box_id text,cache_id uuid,experience_id uuid,title text,description text,difficulty smallint,terrain smallint,latitude double precision,longitude double precision,search_radius_meters integer,setup_status text)
language plpgsql security definer set search_path='' as $$
declare v_box public.physical_treasure_boxes%rowtype; v_cache_id uuid; v_experience_id uuid; v_adventure_id uuid; v_code text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select ptb.* into v_box from public.physical_treasure_boxes ptb where ptb.nfc_public_token=p_nfc_public_token and ptb.owner_id=auth.uid() for update;
 if v_box.id is null then raise exception 'Treasure Box not found or not owned by you'; end if;
 if v_box.claim_status <> 'claimed' then raise exception 'Treasure Box is not available for setup'; end if;
 v_cache_id:=v_box.cache_id; v_experience_id:=v_box.experience_id;
 if v_cache_id is null then
  insert into public.adventures(creator_id,title,slug,summary,status,is_official) values(auth.uid(),'Treasure Box '||v_box.serial_code,'treasure-box-'||lower(replace(v_box.serial_code,'LL-TB-',''))||'-'||substr(v_box.id::text,1,8),'Single Treasure Box','draft',false) returning id into v_adventure_id;
  v_code:='LL-C-'||replace(v_box.serial_code,'LL-TB-','TB-');
  insert into public.caches(adventure_id,creator_id,owner_id,public_code,title,description,difficulty,terrain,status,lifecycle_status) values(v_adventure_id,auth.uid(),auth.uid(),v_code,'Untitled Treasure Box',null,1,1,'draft','draft') returning id into v_cache_id;
  update public.physical_treasure_boxes ptb set cache_id=v_cache_id,updated_at=now() where ptb.id=v_box.id;
 else select c.adventure_id into v_adventure_id from public.caches c where c.id=v_cache_id; end if;
 if v_experience_id is null then
  select pe.id into v_experience_id from public.physical_experiences pe where pe.cache_id=v_cache_id limit 1;
  if v_experience_id is null then insert into public.physical_experiences(experience_type,creator_id,owner_id,cache_id,title,description,visibility,status) values('treasure_box',auth.uid(),auth.uid(),v_cache_id,'Untitled Treasure Box',null,'hidden','draft') returning id into v_experience_id; end if;
  update public.physical_treasure_boxes ptb set experience_id=v_experience_id,updated_at=now() where ptb.id=v_box.id;
 end if;
 insert into public.physical_nfc_tags(experience_id,public_token,status) values(v_experience_id,p_nfc_public_token,'active') on conflict(public_token) do nothing;
 insert into public.cache_nfc_tags(cache_id,public_token,status) values(v_cache_id,p_nfc_public_token,'active') on conflict(public_token) do nothing;
 return query select v_box.id,v_box.serial_code,c.id,v_experience_id,c.title,c.description,c.difficulty,c.terrain,case when sa.search_center is null then null else gis.ST_Y(sa.search_center::gis.geometry) end,case when sa.search_center is null then null else gis.ST_X(sa.search_center::gis.geometry) end,sa.search_radius_meters,v_box.setup_status from public.caches c left join public.cache_search_areas sa on sa.cache_id=c.id where c.id=v_cache_id;
end;$$;