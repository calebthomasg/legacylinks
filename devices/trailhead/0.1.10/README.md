# v0.1.10 — Wi-Fi signal diagnostics

Development date: November 15, 2026 (America/Chicago).

User-reported baseline: v0.1.7 failed with reason 204 away from router. Moving next to router helped substantially; v0.1.8 installed, yellow indicator appeared, and hosted update to v0.1.9 succeeded. Power-cycle and longer-distance stability remain unconfirmed.

## Changes
Settings > Wi-Fi signal shows four bars, live RSSI in dBm, heuristic signal quality, channel, and minimum/maximum valid RSSI during this page visit. It refreshes once a second. Offline state displays no bars, reconnecting status or retry guidance, and the last disconnect reason. Retry saved Wi-Fi moved from Settings to this diagnostic screen. Exiting and reopening resets the visit range.

Heuristics: >= -60 dBm Strong / four bars; -61..-70 Good / three; -71..-80 Weak / two; below -80 Very weak / one. Values must be negative and >= -127; invalid/disconnected readings do not enter min/max. These categories do not guarantee connectivity, throughput, or internet access. RSSI measures what the device receives, not the router's received signal or interference directly.

No transmit-power, power-saving, antenna, scan, retry, credential-storage, display-driver or partition changes. No claim of increased range. Hosted test channel now offers 0.1.10; stable remains empty. Numeric version comparison handles 0.1.10 > 0.1.9.

## Source and verification
source.zip contains the complete sketch, board drivers, embedded artwork, configuration, new SignalQuality.h, and unchanged hosted updater with its version increment. Bundled LVGL 8.3.10 and its configuration remain those of the prior v0.1.8 package. Use Arduino-ESP32 3.0.2 with the matching 3.0.2-h 64-byte/XIP SDK; FlashSize=16M, PSRAM=opi, CDCOnBoot=default, FlashMode=qio, upload.maximum_size=4194304. Keep the 10 MHz panel configuration. App-only OTA leaves Wi-Fi NVS intact.

Tests: actual LVGL rendering of strong/weak/offline states; RSSI category boundaries and invalid values; visit min/max; disconnected readings excluded; buttons' corners inside the 480x480 circle. Existing production-extraction network, uploader and cloud verification harnesses also run. Host tests simulate Wi-Fi and do not measure actual radio performance. signal-ui-test.cpp is the extracted UI harness with simulated readings. Physical v0.1.10 validation is pending.

## Device test
1. Near the router, use Settings > Firmware updates > Check for updates, then Download & install for v0.1.10. Keep power connected.
2. Confirm v0.1.10, Continue, Open, Wi-Fi connected.
3. Open Settings > Wi-Fi signal. Leave it for 30 seconds. Record current reading and visit range.
4. Repeat at the earlier problem location, using the same working power supply/cable. Reopen the signal page to reset its range. Record whether it connects, reading/range if connected, or exact disconnect reason if not.
5. Compare device orientations at the same location. Record conditions; do not change router/radio settings during this baseline comparison.
6. After completed update, unplug/replug once and confirm v0.1.10 and saved Wi-Fi reconnection.

Do not unplug during installation. The updater still does not provide automatic bad-boot rollback; USB recovery remains the fallback.
