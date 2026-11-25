-- A current avatar and its one exact derivative share the same access check.
alter policy "Family Chat members can view current profile photos" on storage.objects
using (
  bucket_id = 'person-photos'
  and exists (
    select 1
    from public.read_chat_profile_photos(array[
      case when split_part(objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(objects.name, '/', 1)::uuid end
    ]) photos
    where objects.name in (photos.photo_path, photos.photo_path || '.thumb-192.jpg')
  )
);
