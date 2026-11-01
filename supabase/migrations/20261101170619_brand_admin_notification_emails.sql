-- Table layout, inline styles, hosted PNGs and a text alternative for email clients.
create function private.admin_email_escape(p_value text) returns text
language sql immutable set search_path='' as $$
  select replace(replace(replace(replace(replace(coalesce(p_value,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');
$$;
revoke all on function private.admin_email_escape(text) from public,anon,authenticated;

create function private.render_admin_notification_email(p_notice public.admin_notifications)
returns jsonb language plpgsql stable set search_path='' as $$
declare
  v_signup boolean:=p_notice.event_type='signup';
  v_name text:=private.admin_email_escape(p_notice.person_name);
  v_box text:=private.admin_email_escape(coalesce(p_notice.box_title,'a treasure box'));
  v_date text:=to_char(p_notice.occurred_at at time zone 'America/Chicago','FMMonth FMDD, YYYY') || ' · ' || to_char(p_notice.occurred_at at time zone 'America/Chicago','FMHH12:MI AM');
  v_subject text; v_text text; v_detail text; v_html text;
begin
  if v_signup then
    v_subject:='Meet your newest Trailblazer, '||p_notice.person_name;
    v_text:=p_notice.person_name||E' is a new LegacyLink Trailblazer.\nAccount created: '||v_date||' Central Time';
    v_detail:='<div style="font-size:10px;letter-spacing:1.6px;font-weight:800;color:#73806f">ACCOUNT CREATED</div>';
  else
    v_subject:=p_notice.person_name||' found '||coalesce(p_notice.box_title,'a treasure box');
    v_text:=p_notice.person_name||' found '||coalesce(p_notice.box_title,'a treasure box')||coalesce(' ('||p_notice.box_code||')','')||E'.\nFound: '||v_date||' Central Time';
    v_detail:='<div style="font-size:10px;letter-spacing:1.6px;font-weight:800;color:#73806f">TREASURE DISCOVERED</div><div style="font-size:22px;line-height:1.3;font-weight:900;color:#165733;margin-top:6px">'||v_box||'</div>'
      ||case when p_notice.box_code is not null then '<div style="font-size:11px;color:#6c7b70;margin-top:6px">BOX ID &nbsp; '||private.admin_email_escape(p_notice.box_code)||'</div>' else '' end
      ||'<div style="border-top:1px solid #e3e9e2;margin:14px 0"></div><div style="font-size:10px;letter-spacing:1.6px;font-weight:800;color:#73806f">FOUND ON</div>';
  end if;
  -- Subjects cannot contain user-controlled header line breaks.
  v_subject:=left(replace(replace(v_subject,E'\r',' '),E'\n',' '),240);
  v_detail:=v_detail||'<div style="font-size:14px;font-weight:800;margin-top:6px">'||v_date||'</div><div style="font-size:11px;color:#758076;margin-top:4px">Central Time</div>';
  v_html:=format($html$<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>LegacyLink admin notification</title></head>
<body style="margin:0;padding:0;background-color:#f5f1e6;color:#0f1d3a;font-family:Nunito,Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">%1$s</div>
<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f1e6"><tr><td align="center" style="padding:28px 12px">
<!--[if mso]><table role="presentation" width="560"><tr><td><![endif]-->
<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e6dd;border-radius:16px">
<tr><td align="center" style="padding:28px 24px 24px;border-bottom:1px solid #edf0e8"><img src="https://www.legacylinks.io/images/email/brand-logo-v1.png" width="182" alt="LegacyLink" style="display:block;width:182px;height:auto;border:0"></td></tr>
<tr><td align="center" style="padding:0 24px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background-color:%2$s;border-radius:0 0 10px 10px;padding:9px 14px;font-size:10px;letter-spacing:1.6px;font-weight:800;color:%3$s;text-align:center">%4$s</td></tr></table></td></tr>
<tr><td align="center" style="padding:20px 24px 14px"><img src="https://www.legacylinks.io/images/email/ranger-%5$s-v1.png" width="210" alt="Ranger Rowan" style="display:block;width:210px;max-width:100%%;height:auto;border:0"></td></tr>
<tr><td align="center" style="padding:0 24px"><h1 style="margin:0;font-family:Nunito,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.2;font-weight:900;letter-spacing:-.5px;overflow-wrap:anywhere">%6$s</h1><p style="font-size:16px;line-height:1.5;margin:10px 0 0;color:#425256">%7$s</p></td></tr>
<tr><td style="padding:24px 24px 0"><table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:18px 14px;background-color:#fafbf7;border:1px solid #e3e9e2;border-radius:12px;overflow-wrap:anywhere">%8$s</td></tr></table></td></tr>
<tr><td style="padding:24px"><table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#165733" style="border-radius:9px"><a href="https://www.legacylinks.io/admin#admin-notifications" style="display:block;padding:16px 12px;color:#ffffff;text-decoration:none;font-family:Nunito,Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;line-height:20px">Open admin dashboard &nbsp; &#8594;</a></td></tr></table></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px"><tr><td align="center" style="padding:20px 12px 0;font-size:11px;line-height:1.8;color:#748074"><strong style="color:#165733;font-size:12px">Every story deserves a trail.</strong><br>You’re receiving this because you’re a LegacyLink admin.<br><a href="https://www.legacylinks.io" style="color:#66796b;text-decoration:none">legacylinks.io</a></td></tr></table>
</td></tr></table></body></html>$html$,
    private.admin_email_escape(v_subject),
    case when v_signup then '#e6f8f3' else '#fff4cf' end,
    case when v_signup then '#165733' else '#75601c' end,
    case when v_signup then 'A NEW ADVENTURE BEGINS' else 'A LITTLE TREASURE. A NEW STORY.' end,
    case when v_signup then 'signup' else 'find' end,
    v_name,
    case when v_signup then 'is a new LegacyLink <strong style="color:#165733">Trailblazer.</strong>' else 'found a LegacyLink <strong style="color:#165733">Treasure Box.</strong>' end,
    v_detail);
  return jsonb_build_object('subject',v_subject,'text',v_text||E'\n\nView your admin dashboard: https://www.legacylinks.io/admin#admin-notifications','html',v_html);
end;
$$;
revoke all on function private.render_admin_notification_email(public.admin_notifications) from public,anon,authenticated;

create or replace function private.enqueue_admin_notification_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_content jsonb;
begin
  v_content:=private.render_admin_notification_email(new);
  insert into private.admin_email_deliveries(notification_id,admin_id,recipient,payload)
    select new.id,a.user_id,lower(trim(u.email)),v_content||jsonb_build_object(
      'from','LegacyLink <support@legacylinks.io>','to',jsonb_build_array(lower(trim(u.email))))
    from public.admin_users a join auth.users u on u.id=a.user_id
    where a.role in ('super_admin','admin','fulfillment') and nullif(trim(u.email),'') is not null
    on conflict(notification_id,admin_id) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_admin_notification_email() from public,anon,authenticated;
-- Existing queued payloads remain immutable so retries retain their idempotency key.
