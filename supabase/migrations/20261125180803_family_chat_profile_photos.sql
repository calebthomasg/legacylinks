-- Family Chat displays the profile photo chosen on a person's own linked
-- profile. Keep every other object in the existing private bucket restricted.
create function public.read_chat_profile_photos(user_ids uuid[])
returns table(user_id uuid, photo_path text)
language sql stable security definer set search_path = '' as $$
  select person.linked_user_id, person.profile_photo_path
  from (
    select distinct on (p.linked_user_id)
      p.linked_user_id, p.profile_photo_path
    from public.people p
    where p.linked_user_id = any(user_ids)
      and p.created_by_user_id = p.linked_user_id
      and (select auth.uid()) is not null
      and (
        p.linked_user_id = (select auth.uid())
        or p.linked_user_id in (select public.chat_connected_user_ids())
        or exists (
          select 1 from public.chat_thread_members m
          join public.chat_thread_members mine on mine.thread_id = m.thread_id
          join public.chat_threads t on t.id = mine.thread_id and t.deleted_at is null
          where m.user_id = p.linked_user_id
            and mine.user_id = (select auth.uid()) and mine.left_at is null
        )
      )
    order by p.linked_user_id, p.created_at desc, p.id desc
  ) person
  where split_part(person.profile_photo_path, '/', 1) = person.linked_user_id::text;
$$;

revoke all on function public.read_chat_profile_photos(uuid[]) from public, anon;
grant execute on function public.read_chat_profile_photos(uuid[]) to authenticated;

create policy "Family Chat members can view current profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'person-photos'
  and exists (
    select 1
    from public.read_chat_profile_photos(array[
      case when split_part(objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(objects.name, '/', 1)::uuid end
    ]) photos
    where photos.photo_path = objects.name
  )
);
