create or replace function public.get_physical_treasure_box_activation_state(p_nfc_public_token uuid)
returns table(physical_box_id uuid,box_id text,claim_status text,setup_status text,is_owner boolean)
language sql stable security definer set search_path='' as $$
  select id,serial_code,claim_status,setup_status,(owner_id is not null and owner_id=auth.uid())
  from public.physical_treasure_boxes
  where nfc_public_token=p_nfc_public_token
  limit 1;
$$;
revoke all on function public.get_physical_treasure_box_activation_state(uuid) from public;
grant execute on function public.get_physical_treasure_box_activation_state(uuid) to anon,authenticated;
