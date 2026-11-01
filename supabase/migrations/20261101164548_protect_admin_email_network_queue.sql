-- Defense in depth where the migration role owns these grants.
-- Managed Supabase installs can retain supabase_admin-owned PUBLIC grants;
-- postgres cannot revoke those. The net schema must remain outside the Data API.
revoke all on table net.http_request_queue, net._http_response from public, anon, authenticated;
