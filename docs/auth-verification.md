# Testing authentication on previews

Signup, password login, and password recovery requests share AuthVerification and useVerifiedAuth. The widget supplies the current challenge response. The hook consumes it once, prevents concurrent submissions, and starts a new challenge after each request. Pass the response as Supabase's options.captchaToken. Reuse both pieces for future protected actions such as sending an OTP.

Vercel embeds NEXT_PUBLIC_TURNSTILE_SITE_KEY at build time. Set it for every supported environment and rebuild older previews after changing it. Select the widget paired with the secret in the target Supabase project's Authentication → Attack Protection settings. Keep the secret in Supabase. Local development needs its own Supabase URL and publishable key in addition to the site key.

Open previews using an authorized hostname. A commit-specific Vercel URL and its stable branch alias are different hosts. For individual branches, authorize the exact Vercel branch alias in Cloudflare Turnstile. Reuse that URL across commits. For many branches, assign branch-specific domains under a domain you control (e.g. measurement.preview.legacylinks.io), configure their DNS for Vercel, and open the assigned domain. The existing legacylinks.io widget entry covers its subdomains. Keep preview access limited to trusted branches when using the shared backend. Never authorize the shared vercel.app parent.

For local signup tests, use a separate development Supabase project with CAPTCHA enabled and a matching real development widget that authorizes the development host. Signup confirmations also need their return URL in the project's Auth redirect allowlist. Use a disposable test account for complete signup and login checks.

## Password recovery

The reset email subject is **Reset your LegacyLink password**. The template is in `supabase/templates/password-recovery.html`. The local Supabase config loads it from that file. For hosted Supabase, install it under Authentication → Email Templates → Reset password.

The template uses the Auth project's Site URL so reset links stay on that project's trusted application. Set the preview Auth project's Site URL to its stable, Turnstile-authorized preview origin, with no trailing slash. Use a separate Auth project for the preview and verify its SMTP delivery. Disable link tracking for authentication emails so the provider preserves the link.

On the preview, use a disposable account to request a reset and open the delivered link in a different browser session. Verify that mismatched passwords leave the link usable, the previous password stops working, the new password signs in to the same account, and a used or expired link allows the user to request another. Compare the request screen for registered and unregistered addresses, and confirm that Turnstile rejects missing or invalid challenges.

For production, coordinate installing the hosted template with deploying the app routes. Verify the production Site URL is `https://legacylinks.io`.
