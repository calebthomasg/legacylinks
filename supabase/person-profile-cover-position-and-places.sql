alter table public.people
  add column if not exists cover_photo_position_x numeric default 50,
  add column if not exists cover_photo_position_y numeric default 50,
  add column if not exists profile_summary text,
  add column if not exists birth_city text,
  add column if not exists birth_state text,
  add column if not exists death_city text,
  add column if not exists death_state text,
  add column if not exists burial_city text,
  add column if not exists burial_state text,
  add column if not exists christening_city text,
  add column if not exists christening_state text,
  add column if not exists baptism_city text,
  add column if not exists baptism_state text;
