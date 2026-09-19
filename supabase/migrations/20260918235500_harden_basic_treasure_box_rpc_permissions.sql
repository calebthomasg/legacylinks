-- Restrict authenticated-only Treasure Box actions from anonymous callers.

revoke all on function public.admin_provision_physical_treasure_box(text) from public, anon;
grant execute on function public.admin_provision_physical_treasure_box(text) to authenticated;

revoke all on function public.claim_physical_treasure_box_by_pin(uuid,text) from public, anon;
grant execute on function public.claim_physical_treasure_box_by_pin(uuid,text) to authenticated;

revoke all on function public.record_physical_nfc_scan(uuid) from public, anon;
grant execute on function public.record_physical_nfc_scan(uuid) to authenticated;

revoke all on function public.record_treasure_box_find(uuid) from public, anon;
grant execute on function public.record_treasure_box_find(uuid) to authenticated;
