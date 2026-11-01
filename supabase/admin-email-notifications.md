# Admin email notifications

New `admin_notifications` rows queue one email for each current super admin, admin,
or fulfillment admin with an account email. Signup messages include the name and
account creation date; treasure-find messages include the finder, box title/code,
and find date. Dates use America/Chicago. Existing notifications are not backfilled.

The database cron job `admin-notification-emails` runs every minute and sends one
queued email per run through Resend. It works independently of frontend deployments
and does not need a browser or local server running. Provider failures cannot
interrupt signup or finding a box. Designated test boxes remain excluded by the
notification capture trigger.

Sender: `LegacyLink <support@legacylinks.io>`. The sending-only Resend credential is
restricted to `legacylinks.io` and stored in Supabase Vault as
`admin_notifications_resend_api_key`. Never put it in client code or migrations.
The domain uses a TXT record at `resend._domainkey` and CNAME records at `send` and
`rsend`; existing Titan mailbox records remain in place.

The account uses Resend Free with pay-as-you-go disabled. The worker conservatively
limits attempts to 90 per rolling 24 hours and 2,900 per rolling 31 days, counting
retries. Excess notifications stay queued. Other apps using the same Resend account
share the provider's allowance. No automatic upgrade is configured.

Pending recipients are rechecked against the current admin list and account email.
Revoked admins or changed addresses are cancelled. Retries reuse an immutable
payload and idempotency key, with exponential backoff and a maximum of eight
attempts. Ambiguous failures stop after 23 hours, within Resend's 24-hour
idempotency window. Failed rows require operator review; do not blindly reset
ambiguous deliveries after that window. `accepted` means accepted by Resend;
inbox delivery and bounces are visible in Resend's email dashboard.

Operator SQL (postgres only):

```sql
-- Pause/resume without deleting queued activity.
update private.admin_email_settings set enabled = false where singleton;
update private.admin_email_settings set enabled = true where singleton;

-- Inspect delivery health without revealing credentials or message contents.
select status, count(*) from private.admin_email_deliveries group by status;
select id, status, attempts, last_error, created_at
from private.admin_email_deliveries where status='failed' order by created_at desc;
select status, return_message, start_time
from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='admin-notification-emails')
order by start_time desc limit 10;
```

Tests: `tests/admin-notifications.sql` and `tests/admin-email-notifications.sql`.
Run each as postgres. Fixtures and HTTP requests are rolled back, so the tests
do not send real email. The email test temporarily pauses delivery inside its
transaction, then restores the previous configuration on rollback.

Private tables intentionally enable RLS without client policies and revoke client
grants. Their default-deny advisor notices are expected; only internal postgres
functions and the scheduled job access them.

The managed `net` extension schema must remain outside exposed Data API schemas:
its transient HTTP queue contains authorization headers. Supabase owns that
schema and its default table grants, which postgres cannot override. The
defense-in-depth revoke migration may therefore leave those owner grants intact.
