# Testing authentication on previews

Signup and password login share AuthVerification and useVerifiedAuth. The widget supplies the current challenge response. The hook consumes it once, prevents concurrent submissions, and starts a new challenge after each request. Pass the response as Supabase's options.captchaToken. Reuse both pieces for future protected actions such as requesting a password reset or sending an OTP.

Vercel embeds NEXT_PUBLIC_TURNSTILE_SITE_KEY at build time. Set it for every supported environment and rebuild older previews after changing it. Select the widget paired with the secret in the target Supabase project's Authentication → Attack Protection settings. Keep the secret in Supabase. Local development needs its own Supabase URL and publishable key in addition to the site key.

Open previews using an authorized hostname. A commit-specific Vercel URL and its stable branch alias are different hosts. For individual branches, authorize the exact Vercel branch alias in Cloudflare Turnstile. Reuse that URL across commits. For many branches, assign branch-specific domains under a domain you control (e.g. measurement.preview.legacylinks.io), configure their DNS for Vercel, and open the assigned domain. The existing legacylinks.io widget entry covers its subdomains. Keep preview access limited to trusted branches when using the shared backend. Never authorize the shared vercel.app parent.

For local signup tests, use a separate development Supabase project with CAPTCHA enabled and a matching real development widget that authorizes the development host. Confirmations and password recovery links also need the intended return URL allowed in that project's Auth URL configuration. Use a disposable test account for complete signup and login checks.
