# Supabase migration reconciliation

Audit basis: feature branch commit `ce7d60364e5e0508590a4f6a218b8caa7f6296a9` and the hosted Supabase migration ledger, November 21, 2026.

## Findings

- 53 versions are recorded in Supabase and 33 files are on the feature branch. 30 match by migration name. Of those, 17 match after trimming outer whitespace and normalizing line endings, 10 match after comparison of SQL tokens, and 3 have differences listed below.
- 23 earlier migrations exist in the hosted ledger without a file under `supabase/migrations`. The ledger begins after some prerequisites were already installed. For example, the recorded family-tree linking migration refers to `public.people` and no earlier recorded migration creates that table. A blank database replay requires a schema baseline with the pre-ledger application objects.
- Two historical repository-only migrations have their effects in the live schema. The current function bodies match the source for the inventory list, find history, and both feedback overloads. The inventory environment column, default, and both test-box designations were also confirmed. The absence of a ledger row does not establish that a migration is pending.
- The two repository files with the prefix `20260828235000` map to different hosted versions. Hosted history applies the conflict-target fix before adding content selection.
- The new Trailblazer migration has no hosted ledger row. A read-only catalog check confirmed the new family table is absent from the hosted project.

## Recorded version mapping

| Migration | Repository version | Hosted version | Comparison |
| --- | --- | --- | --- |
| `add_treasure_box_provisioning_foundation` | `20260828033000` | `20260828034137` | SQL tokens match |
| `add_admin_and_fulfillment_foundation` | `20260828043000` | `20260828035230` | Hosted SQL includes a production-specific admin assignment. Keep that assignment out of portable staging migrations. |
| `fix_treasure_box_pin_hashing` | `20260828050000` | `20260828040643` | SQL tokens match |
| `add_treasure_box_activation_state_lookup` | `20260828174500` | `20260828223516` | SQL matches |
| `add_claimed_treasure_box_setup_foundation` | `20260828224500` | `20260828225252` | SQL tokens match |
| `fix_claimed_treasure_box_setup_cache_ambiguity` | `20260828231000` | `20260828230140` | SQL matches |
| `fully_qualify_claimed_treasure_box_setup` | `20260828233500` | `20260828231041` | SQL matches |
| `add_treasure_box_content_selection` | `20260828235000` | `20260828233139` | SQL tokens match |
| `fix_treasure_box_setup_conflict_targets` | `20260828235000` | `20260828232017` | SQL matches |
| `add_treasure_box_digital_story_builder` | `20260829000500` | `20260828235349` | SQL tokens match |
| `extend_treasure_box_story_chapter_details` | `20260829013000` | `20260829030307` | SQL matches |
| `add_story_chapter_image_uploads` | `20260902014500` | `20260902021918` | SQL matches |
| `add_traveling_token_foundation` | `20260902171000` | `20260902171136` | SQL matches |
| `add_traveling_token_provisioning` | `20260902173500` | `20260902171714` | SQL matches |
| `fix_traveling_token_pgcrypto_schema` | `20260902174500` | `20260902173417` | SQL matches |
| `add_admin_physical_item_inventory` | `20260903013000` | `20260903013044` | SQL tokens match |
| `add_traveling_token_initial_setup` | `20260903022000` | `20260903014116` | SQL matches |
| `add_traveling_token_find_and_replant` | `20260904232000` | `20260904231607` | SQL matches |
| `add_treasure_box_test_pin_admin_tools` | `20260918231000` | `20260918234020` | SQL tokens match |
| `complete_basic_treasure_box_publish_lifecycle` | `20260918234434` | `20260918234434` | SQL matches |
| `harden_basic_treasure_box_rpc_permissions` | `20260918235500` | `20260918235514` | SQL tokens match |
| `fix_private_location_upsert_constraint` | `20260919000000` | `20260918235746` | SQL tokens match |
| `designate_test_treasure_boxes` | `20260919005551` | None | Historical schema effects verified |
| `hide_test_treasure_boxes_from_public_trailhead` | `20260919151413` | `20260919151525` | SQL matches |
| `add_published_treasure_box_metadata_editor` | `20260927013543` | `20260927020715` | Hosted SQL adds a PostgREST schema reload notification. |
| `add_treasure_box_find_history` | `20260927022126` | None | Historical schema effects verified |
| `sitewide_notices` | `20261011180000` | `20261011181239` | Hosted SQL uses `IF NOT EXISTS` for the table and published-notices index. |
| `add_optional_treasure_box_hints` | `20261025212419` | `20261025212419` | SQL matches |
| `add_admin_notifications` | `20261101160319` | `20261101160503` | SQL matches |
| `add_admin_email_notifications` | `20261101163734` | `20261101164037` | SQL matches |
| `protect_admin_email_network_queue` | `20261101164548` | `20261101164601` | SQL tokens match |
| `brand_admin_notification_emails` | `20261101170619` | `20261101171233` | SQL matches |
| `add_trailblazer_family_foundation` | `20261121173524` | None | New migration |

## Hosted versions missing from the migration directory

| Version | Migration |
| --- | --- |
| `20260821014532` | `enable_postgis_for_cache_locations` |
| `20260821014837` | `create_adventures` |
| `20260821015223` | `create_cache_location_foundation` |
| `20260821015237` | `tighten_cache_table_privileges` |
| `20260821015724` | `create_cache_nfc_tags` |
| `20260821021824` | `add_secure_nfc_cache_lookup` |
| `20260822010554` | `add_authenticated_nfc_story_reveal` |
| `20260822012317` | `add_trailhead_cache_lookup` |
| `20260822012328` | `restrict_trailhead_cache_lookup_to_authenticated` |
| `20260823024429` | `add_treasure_box_find_feedback` |
| `20260823031845` | `add_trail_log_photos_and_find_created_date` |
| `20260823033318` | `add_gallery_media_for_trailhead` |
| `20260823220650` | `add_treasure_box_creator_foundation` |
| `20260823221003` | `add_my_treasure_boxes_lookup` |
| `20260824194621` | `add_physical_discovery_types_and_tokens` |
| `20260824195151` | `add_trailhead_discovery_feed` |
| `20260824231848` | `add_my_trailhead_items_lookup` |
| `20260824231900` | `add_memorial_creator_function` |
| `20260825003139` | `add_unified_my_treasure_rpc` |
| `20260825011713` | `link_memorials_to_family_tree_people` |
| `20260825015704` | `add_memorial_edit_and_safe_delete` |
| `20260825023930` | `add_physical_discovery_events` |
| `20260825024516` | `add_memorial_detail_profiles` |

## Staging verification and rollout

1. Prepare an isolated Supabase development database from a schema-only baseline with the project's existing roles and extensions. Keep production records, account-role assignments, and secrets out of the staging fixtures.
2. Verify the baseline against the live schema catalog and compare the staging ledger with the mapping above. Preserve hosted version IDs when rebuilding the migration directory. Record the two historical Git-only changes at their verified positions in staging or include their effects in the baseline. Review SQL that differs before moving it into a portable replay.
3. Validate a clean staging replay, then check a dry run against a staging clone of the existing schema. The upgrade should queue only the new Trailblazer migration. Run the Trailblazer authorization and identity tests after applying it.
4. After those checks, review the exact production change separately. A ledger repair records or removes history entries and needs evidence for each entry. It does not apply or undo schema changes. See the [Supabase deployment and migration guidance](https://supabase.com/docs/guides/deployment/database-migrations).

The comparison and schema checks were read-only. The new migration passed an earlier isolated PostgreSQL fixture test. Full compatibility with a reconstructed Supabase schema remains pending. No hosted schema or migration ledger was modified during this audit.
