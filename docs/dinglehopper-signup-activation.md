# Dinglehopper signup and activation

## Phase 1 architecture assessment

| Area | Verified baseline | Development path |
| --- | --- | --- |
| Website | Next.js 16.2.4 App Router on Vercel. The ready production deployment was built from GitHub `main` at `d4441999e07c7aaeb9fb3cd992c0413f31a8b0b5`. | Use the existing website and account shell for setup and Family & Devices. |
| Authentication | `app/signup/page.tsx` and `app/login/page.tsx` use Supabase email/password auth. `utils/supabase/client.ts`, `utils/supabase/server.ts`, and `utils/auth/returnPath.ts` provide clients and safe return navigation. | Preserve current sign-in and account IDs. Review all signup entry points before adding age screening, including the Trailhead entry at `app/join/page.tsx`. Keep pairing context in an expiring server-side session across login and email confirmation. |
| Abuse prevention | `components/AuthVerification.tsx` supplies Turnstile tokens on signup and login when a site key is present. The latest ready production deployment contains the integration. | Verify the hosted Auth CAPTCHA setting and preview configuration independently. Apply endpoint-specific limits to pairing session creation, PIN lookup, and claim attempts. |
| Profile data | Live `public.profiles.id` references `auth.users.id` and uses self-only RLS. Auth insert triggers create a profile, a linked person, and an admin notification. | Keep these account records and triggers. Preserve the existing Auth UUID as the Trailblazer ID for existing users when they first use the new feature. |
| Family data | `public.people`, `public.family_relationships`, and `public.family_connection_requests` represent genealogy and social connections. `people` uses creator-scoped RLS. Existing chat, journals, and Trailhead records depend on Auth IDs. | Use dedicated guardian authorization records. A family-tree relationship confers no account or device permissions. Keep existing feature ownership and RLS intact. |
| Device data | The live schema has physical item and NFC tables, including `physical_nfc_tags` and `physical_treasure_boxes`. The inspected schema contains no Dinglehopper device or pairing registry. | Create an authenticated device registry and pairing flow in a later migration. Device assignment and game progress will reference the Trailblazer identity. Existing item and OTA paths remain independent. |
| Database environments | The active Supabase project is `legacylinks` on PostgreSQL 17. The connector returned no Supabase branches. Another project named `legacy` is inactive. | Use a disposable database for migration tests and a separately configured test backend for end-to-end preview. Verify preview environment targets before connecting signup or pairing. |

## Phase 2 foundation

The additive migration creates five tables in the existing private schema:

- `trailblazer_identities` gives each Trailblazer a stable ID with an optional unique Auth link. Existing users retain their Auth UUID. Managed children can have an identity before they have a login. A future verified teen transition attaches a new Auth credential to the same Trailblazer ID.
- `trailblazer_families` groups managed profiles.
- `trailblazer_family_guardians` records guardian membership and revocation.
- `trailblazer_managed_children` records each child's family membership.
- `trailblazer_guardian_consents` records verified, purpose-specific consent, policy version, and withdrawal. Foreign keys scope consent to a guardian and child in the same family, and unique constraints guard against reusing the same verification for the same purpose.

The migration enables RLS and revokes table privileges from API roles. It creates no account, child information, API, or background job. The service layer will assign the existing Auth UUID lazily. This avoids a production user backfill and keeps age classification and genealogy independent.

The first managed-profile write should create the identity, membership, and verified consent atomically after the backend validates the verification result and the guardian’s authority. Every child read, update, and device assignment must resolve the signed-in actor, verify active per-child authority, and enforce applicable consent. A family membership alone grants no child access. Keep pre-consent choices local and ephemeral. The approved verification method, supported jurisdictions, notices, proof retention, and withdrawal behavior remain launch decisions. See the [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

## Remaining implementation order

1. **Guardian consent and family services.** Add narrowly scoped server-side operations, verified consent ingestion with retry handling, privacy preferences, and audit records for sensitive changes. Plan identity linking for eligible teens before creating an independent login path.
2. **Signup and account UI.** Extend `/signup` with neutral age screening. Add `/profile/family-devices` using the existing profile shell, then add `/signup/dinglehopper` for new and existing users. Keep location sharing off by default and gate location reporting until its policies and retention are approved.
3. **Device activation services.** Add device credentials, assignments, expiring one-time pairing sessions, and audit events under the website's `app/api` conventions. The QR or PIN locates a pending session. A signed-in, authorized person confirms the assigned Trailblazer and the authenticated device completes a separate device-bound exchange. Keep pairing secrets out of analytics and logs. Confirm the hardware credential provisioning approach before accepting production device claims.
4. **Simulator and rollout.** Exercise QR and PIN pairing, unauthorized assignment, replay, expiry, cancellation, network recovery, transfer, and revocation against a test backend. Include sibling and unrelated-guardian isolation, the existing signup journey, consent withdrawal, and preservation of the Trailblazer ID after linking a teen login. Firmware integration starts after web/backend acceptance.

## Migration and release

Reconcile Git migration filenames with hosted migration history before a staging or production push. For example, GitHub `main` names the sitewide-notice migration `20261011180000` while hosted history records `20261011181239`. GitHub also contains two files starting with `20260828235000`. Compare the SQL with hosted history before any full reset or synchronized push. Apply new migrations first to a separate test database. The foundation is additive. Before storing live data, rollback can remove the new empty tables in dependency order. After storing live data, use a forward correction and preserve consent and identity records according to the approved retention policy.

## Foundation validation

Applied the migration in isolated PostgreSQL 17.5 using synthetic Auth accounts and API roles. The checks passed for multiple children in a family, rejection of cross-family consent, duplicate receipt and active consent rejection, consent withdrawal and renewal, stable identity after credential changes, one-to-one Auth links, RLS on every new table, and select denial for all API roles even with schema usage and permissive default table grants. The isolated test modeled the Auth foreign key and roles. Hosted Auth configuration and the complete historical migration chain require separate staging validation.
