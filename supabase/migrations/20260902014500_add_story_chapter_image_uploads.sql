insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('story-images','story-images',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

alter table public.treasure_box_story_chapters add column if not exists image_alt text;

create policy "Story image owners can view" on storage.objects for select to authenticated using (
  bucket_id='story-images' and (storage.foldername(name))[1]=(select auth.uid()::text)
);
create policy "Story image owners can upload" on storage.objects for insert to authenticated with check (
  bucket_id='story-images' and (storage.foldername(name))[1]=(select auth.uid()::text)
);
create policy "Story image owners can update" on storage.objects for update to authenticated using (
  bucket_id='story-images' and (storage.foldername(name))[1]=(select auth.uid()::text)
) with check (
  bucket_id='story-images' and (storage.foldername(name))[1]=(select auth.uid()::text)
);
create policy "Story image owners can delete" on storage.objects for delete to authenticated using (
  bucket_id='story-images' and (storage.foldername(name))[1]=(select auth.uid()::text)
);

create or replace function public.set_claimed_treasure_box_story_chapter_image(p_story_id uuid,p_chapter_id uuid,p_image_path text,p_image_alt text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.treasure_box_stories s where s.id=p_story_id and s.creator_id=auth.uid()) then raise exception 'Story not found'; end if;
 update public.treasure_box_story_chapters c set image_path=nullif(trim(coalesce(p_image_path,'')),''),image_alt=nullif(trim(coalesce(p_image_alt,'')),''),updated_at=now() where c.id=p_chapter_id and c.story_id=p_story_id;
 if not found then raise exception 'Chapter not found'; end if;
end;$$;

drop function if exists public.get_claimed_treasure_box_story_chapters(uuid);
create function public.get_claimed_treasure_box_story_chapters(p_story_id uuid)
returns table(chapter_id uuid,chapter_number integer,title text,body text,image_path text,image_prompt text,image_alt text)
language sql stable security definer set search_path='' as $$
 select c.id,c.chapter_number,c.title,c.body,c.image_path,c.image_prompt,c.image_alt from public.treasure_box_story_chapters c join public.treasure_box_stories s on s.id=c.story_id where c.story_id=p_story_id and s.creator_id=auth.uid() order by c.chapter_number;
$$;

revoke all on function public.get_claimed_treasure_box_story_chapters(uuid) from public;
grant execute on function public.get_claimed_treasure_box_story_chapters(uuid) to authenticated;
revoke all on function public.set_claimed_treasure_box_story_chapter_image(uuid,uuid,text,text) from public;
grant execute on function public.set_claimed_treasure_box_story_chapter_image(uuid,uuid,text,text) to authenticated;
