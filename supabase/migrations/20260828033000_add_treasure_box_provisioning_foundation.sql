create extension if not exists pgcrypto;

alter table public.physical_treasure_boxes
  add column if not exists activation_pin_hash text,
  add column if not exists activation_pin_last4 text,
  add column if not exists pin_generated_at timestamptz,
  add column if not exists pin_consumed_at timestamptz,
  add column if not exists nfc_public_token uuid unique,
  add column if not exists provisioned_at timestamptz,
  add column if not exists setup_status text not null default 'not_started';

alter table public.physical_treasure_boxes drop constraint if exists physical_treasure_boxes_setup_status_check;
alter table public.physical_treasure_boxes add constraint physical_treasure_boxes_setup_status_check check (setup_status in ('not_started','in_progress','ready_to_publish','published'));

create sequence if not exists public.physical_treasure_box_serial_seq start 1;

create or replace function public.format_physical_treasure_box_serial(p_number bigint)
returns text language sql immutable set search_path='' as $$
  select 'LL-TB-' || lpad(p_number::text,6,'0');
$$;

create or replace function public.generate_treasure_box_activation_pin()
returns text language plpgsql volatile set search_path='' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result text := ''; i integer;
begin
  for i in 1..6 loop result := result || substr(alphabet,1+floor(random()*length(alphabet))::integer,1); end loop;
  return result;
end;
$$;

create or replace function public.provision_physical_treasure_box(p_edition text default null)
returns table(physical_box_id uuid, box_id text, activation_pin text, nfc_public_token uuid, nfc_path text)
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_serial text:=public.format_physical_treasure_box_serial(nextval('public.physical_treasure_box_serial_seq')); v_pin text:=public.generate_treasure_box_activation_pin(); v_nfc uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' then raise exception 'Provisioning requires service role'; end if;
  insert into public.physical_treasure_boxes(id,serial_code,edition,claim_status,activation_pin_hash,activation_pin_last4,pin_generated_at,nfc_public_token,provisioned_at,setup_status)
  values(v_id,v_serial,p_edition,'unclaimed',crypt(v_pin,gen_salt('bf',10)),right(v_pin,4),now(),v_nfc,now(),'not_started');
  return query select v_id,v_serial,v_pin,v_nfc,'/n/'||v_nfc::text;
end;
$$;

create or replace function public.get_unclaimed_treasure_box_by_nfc(p_nfc_public_token uuid)
returns table(physical_box_id uuid, box_id text, claim_status text, setup_status text)
language sql stable security definer set search_path='' as $$
 select id,serial_code,claim_status,setup_status from public.physical_treasure_boxes where nfc_public_token=p_nfc_public_token and claim_status='unclaimed' limit 1;
$$;

create or replace function public.claim_physical_treasure_box_by_pin(p_nfc_public_token uuid,p_activation_pin text)
returns table(physical_box_id uuid, box_id text, was_claimed boolean, setup_status text)
language plpgsql security definer set search_path='' as $$
declare v_box public.physical_treasure_boxes%rowtype; v_pin text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_pin:=upper(regexp_replace(coalesce(p_activation_pin,''),'[^A-Z0-9]','','g'));
 if length(v_pin)<>6 then raise exception 'Enter the 6-character activation PIN'; end if;
 select * into v_box from public.physical_treasure_boxes where nfc_public_token=p_nfc_public_token for update;
 if v_box.id is null then raise exception 'Treasure box not found'; end if;
 if v_box.owner_id is not null then
  if v_box.owner_id=auth.uid() then return query select v_box.id,v_box.serial_code,false,v_box.setup_status; return; end if;
  raise exception 'Treasure box already claimed';
 end if;
 if v_box.claim_status<>'unclaimed' then raise exception 'Treasure box is not available to claim'; end if;
 if v_box.activation_pin_hash is null or crypt(v_pin,v_box.activation_pin_hash)<>v_box.activation_pin_hash then raise exception 'Activation PIN does not match this Treasure Box'; end if;
 update public.physical_treasure_boxes set owner_id=auth.uid(),claim_status='claimed',claimed_at=now(),pin_consumed_at=now(),setup_status='in_progress',updated_at=now() where id=v_box.id;
 return query select v_box.id,v_box.serial_code,true,'in_progress'::text;
end;
$$;

revoke all on function public.provision_physical_treasure_box(text) from public,anon,authenticated;
grant execute on function public.provision_physical_treasure_box(text) to service_role;
revoke all on function public.get_unclaimed_treasure_box_by_nfc(uuid) from public;
grant execute on function public.get_unclaimed_treasure_box_by_nfc(uuid) to anon,authenticated;
revoke all on function public.claim_physical_treasure_box_by_pin(uuid,text) from public;
grant execute on function public.claim_physical_treasure_box_by_pin(uuid,text) to authenticated;
