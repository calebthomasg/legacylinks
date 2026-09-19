create or replace function public.get_trailhead_caches()
returns table(
  cache_id uuid,
  public_code text,
  title text,
  description text,
  difficulty smallint,
  terrain smallint,
  chapter_number integer,
  adventure_id uuid,
  adventure_title text,
  adventure_slug text,
  search_latitude double precision,
  search_longitude double precision,
  search_radius_meters integer,
  arrival_latitude double precision,
  arrival_longitude double precision,
  created_at timestamptz,
  unique_find_count bigint,
  average_rating numeric,
  recent_comments jsonb
)
language sql
stable
security definer
set search_path=''
as $$
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
$$;

revoke all on function public.get_trailhead_caches() from public, anon;
grant execute on function public.get_trailhead_caches() to authenticated;

create or replace function public.get_trailhead_discovery_items()
returns table(
  experience_id uuid,
  experience_type text,
  cache_id uuid,
  title text,
  description text,
  latitude double precision,
  longitude double precision,
  search_radius_meters integer,
  marker_variant text,
  teaser_text text
)
language sql
stable
security definer
set search_path=''
as $$
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
$$;

revoke all on function public.get_trailhead_discovery_items() from public, anon;
grant execute on function public.get_trailhead_discovery_items() to authenticated;
