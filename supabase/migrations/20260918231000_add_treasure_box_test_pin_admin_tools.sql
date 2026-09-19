-- Admin-only tools for reusing designated physical Treasure Box test units.
-- Keeps serial codes and NFC public tokens intact while preserving one-time PIN security.

create or replace function public.admin_regenerate_treasure_box_activation_pin(p_box_id text)
returns table(box_id text, activation_pin text, nfc_public_token uuid, nfc_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_box public.physical_treasure_boxes%rowtype;
  v_pin text;
begin
  if not public.is_legacy_link_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_box
  from public.physical_treasure_boxes
  where serial_code = upper(trim(p_box_id))
  for update;

  if v_box.id is null then raise exception 'Treasure Box not found'; end if;
  if v_box.claim_status <> 'unclaimed' or v_box.owner_id is not null then
    raise exception 'Activation PIN can only be regenerated for an unclaimed Treasure Box';
  end if;

  v_pin := public.generate_treasure_box_activation_pin();

  update public.physical_treasure_boxes
  set activation_pin_hash = public.hash_treasure_box_activation_pin(v_pin),
      activation_pin_last4 = right(v_pin, 4),
      pin_generated_at = now(),
      pin_consumed_at = null,
      updated_at = now()
  where id = v_box.id;

  return query
  select v_box.serial_code, v_pin, v_box.nfc_public_token, '/n/' || v_box.nfc_public_token::text;
end;
$$;

revoke all on function public.admin_regenerate_treasure_box_activation_pin(text) from public, anon;
grant execute on function public.admin_regenerate_treasure_box_activation_pin(text) to authenticated;

create or replace function public.admin_reset_designated_test_treasure_box(p_box_id text, p_confirmation text)
returns table(box_id text, activation_pin text, nfc_public_token uuid, nfc_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_box public.physical_treasure_boxes%rowtype;
  v_pin text;
  v_adventure_id uuid;
begin
  if not public.is_legacy_link_super_admin() then
    raise exception 'Super admin access required';
  end if;

  select * into v_box
  from public.physical_treasure_boxes
  where serial_code = upper(trim(p_box_id))
  for update;

  if v_box.id is null then raise exception 'Treasure Box not found'; end if;
  if v_box.serial_code not in ('LL-TB-000004','LL-TB-000007') then
    raise exception 'Only designated physical test boxes can use this reset';
  end if;
  if trim(coalesce(p_confirmation,'')) <> 'RESET ' || v_box.serial_code then
    raise exception 'Confirmation must exactly match RESET %', v_box.serial_code;
  end if;

  if exists (
    select 1 from public.traveling_tokens tt
    where tt.current_box_id = v_box.id and tt.status in ('in_circulation','in_transit')
  ) then
    raise exception 'This Treasure Box currently contains an active Traveling Token';
  end if;

  if v_box.cache_id is not null then
    select c.adventure_id into v_adventure_id from public.caches c where c.id = v_box.cache_id;
    delete from public.caches where id = v_box.cache_id;
    if v_adventure_id is not null
       and not exists (select 1 from public.caches c where c.adventure_id = v_adventure_id) then
      delete from public.adventures where id = v_adventure_id;
    end if;
  end if;

  v_pin := public.generate_treasure_box_activation_pin();

  update public.physical_treasure_boxes
  set owner_id = null,
      cache_id = null,
      experience_id = null,
      claim_status = 'unclaimed',
      claimed_at = null,
      setup_status = 'not_started',
      content_options = '{}'::text[],
      activation_pin_hash = public.hash_treasure_box_activation_pin(v_pin),
      activation_pin_last4 = right(v_pin, 4),
      pin_generated_at = now(),
      pin_consumed_at = null,
      updated_at = now()
  where id = v_box.id;

  return query
  select v_box.serial_code, v_pin, v_box.nfc_public_token, '/n/' || v_box.nfc_public_token::text;
end;
$$;

revoke all on function public.admin_reset_designated_test_treasure_box(text,text) from public, anon;
grant execute on function public.admin_reset_designated_test_treasure_box(text,text) to authenticated;
