begin;
do $$
declare n public.admin_notifications; payload jsonb;
begin
  n.person_name:='<script>alert("x")</script> & Jordan';
  n.event_type:='signup'; n.occurred_at:='2026-11-01T16:42:00Z';
  payload:=private.render_admin_notification_email(n);
  if payload->>'html' like '%<script>%' or payload->>'html' not like '%&lt;script&gt;%' then raise exception 'Name not escaped'; end if;
  if payload->>'html' not like '%is a new LegacyLink%' or payload->>'html' not like '%Trailblazer.%' then raise exception 'Signup copy missing'; end if;
  if payload->>'html' not like '%brand-logo-v1.png%' or payload->>'html' not like '%ranger-signup-v1.png%' then raise exception 'Brand assets missing'; end if;
  if payload->>'text' not like '%10:42 AM Central Time%' then raise exception 'Central date conversion incorrect'; end if;
  n.event_type:='treasure_find'; n.box_title:='Oak <Creek> & Adventure'; n.box_code:='LL-TB-000042';
  payload:=private.render_admin_notification_email(n);
  if payload->>'html' not like '%Oak &lt;Creek&gt; &amp; Adventure%' or payload->>'html' not like '%LL-TB-000042%' then raise exception 'Box details not safely rendered'; end if;
  if payload->>'html' not like '%ranger-find-v1.png%' then raise exception 'Find art missing'; end if;
  n.person_name:=E'Jordan\nBcc: test'; n.box_title:=null; n.box_code:=null;
  payload:=private.render_admin_notification_email(n);
  if payload->>'subject' like E'%\n%' or payload->>'html' is null or payload->>'text' not like '%a treasure box%' then raise exception 'Fallback or subject invalid'; end if;
end;
$$;
rollback;
select 'PASS: approved branding, signup/find content, date formatting, missing details, header normalization and HTML escaping' as result;
