# v0.1.11 — event-driven Wi-Fi retries

Date: November 15, 2026 (America/Chicago). Physical acceptance pending.

## Problem and behavior
The user reports approximately -63 dBm at the original location, with initial connection needing a couple of attempts before success. Prior firmware recorded disconnect reasons but waited for a 30-second attempt timeout plus a five-second pause. This release responds to explicit driver failure events rather than waiting out that timeout.

Saved-network connections allow three attempts total: retry after one second following the first failure and two seconds following the second. The initial scheduled attempt starts after a one-second settling interval. A still-pending attempt keeps the 30-second watchdog. Loss of an established connection schedules saved-network recovery after one second. A manual new-password attempt retains the existing one-attempt behavior; unverified credentials never replace the last working record. A pending user-requested scan takes priority after failure.

The Wi-Fi callback only updates atomics. The main loop consumes the failure flag and schedules WiFi.begin, avoiding networking/UI work inside the callback. Cancellation disarms failure processing and clears pending flags before calling disconnect. Locally generated reason 8 (association leave) is excluded from fast retry to avoid stale intentional-disconnect events. An actual remote reason 8 during joining consequently falls back to the watchdog; this is a deliberate conservative exception. Events received while no attempt is armed cannot schedule a retry. No event generation IDs are exposed by the Wi-Fi driver; physical stress testing remains necessary.

Dashboard now shows elapsed seconds while connecting, and total time/attempts after successful IP-ready Wi-Fi status. Timing starts when the firmware requests the connection, including initial settling and retry pauses; it excludes time spent on the initial display test before Continue. Seconds are rounded down. These measurements do not guarantee internet reachability.

Transmit power, power saving, antenna settings, panel driver, saved-credential format, OTA and partition layout remain unchanged. This can reduce idle waiting after failure; it does not establish or fix the cause of the first handshake failure.

## Source/build
source.zip contains the complete sketch, board drivers, artwork, production-extraction regression tests, UI harness and lv_conf.h. Use the bundled LVGL 8.3.10 from the v0.1.8 package, Arduino-ESP32 3.0.2 and the matching 3.0.2-h XIP/64-byte SDK. FQBN options: FlashSize=16M, PSRAM=opi, CDCOnBoot=default, FlashMode=qio; upload.maximum_size=4194304; keep 10 MHz panel clock. Build output is recorded alongside this document. Only app firmware is updated; Wi-Fi NVS is preserved.

## Verification
- Production-extracted network harness passes: early 204 failure retry before watchdog; 1s/2s backoffs; three-attempt bound; full watchdog; cancel/late reason-8 handling; saved credentials; failed replacement preservation; scan exclusion and priority; established-connection recovery; elapsed/attempt metrics; millis wraparound.
- Existing local OTA and hosted catalog/download failure harnesses pass.
- Actual LVGL host renders show elapsed/attempt status and verify connected text ends above dashboard buttons. Wi-Fi and flash are mocked in these tests, not physical passes.
- ESP32-S3 sketch compiles within the 4 MB app slot. Image checksum/validation hash and release catalog byte/hash checks are verified before publication.

## Physical comparison
1. Near router, install v0.1.11 through Firmware updates. Keep power connected throughout installation.
2. After completed restart, tap Continue and Open; confirm saved Wi-Fi connects and note 'Joined in ... / ... attempt(s)'.
3. At the original -63 dBm location using the same working power setup, restart three times (only after installation completes). For each, record version, joined seconds, attempt count, signal reading, and any failure reason. Do not change router settings or forget credentials during this comparison.
4. Observe a connected session for several minutes, then enter/leave Wi-Fi settings and confirm it remains connected. Confirm Check for updates still works.
5. Separately verify Forget Wi-Fi does not automatically reconnect; re-enter credentials only when deliberately testing this destructive-to-settings action. It is not needed for the initial timing comparison.

Success: shorter total connection time under comparable conditions without extra disconnects, incorrect saved passwords, or unbounded retries. No speed improvement is claimed until physical comparison. Stable channel remains withheld.
