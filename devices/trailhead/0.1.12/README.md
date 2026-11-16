# v0.1.12 — Dinglehopper swipe opener and rotary menu

Development date: November 15, 2026 (America/Chicago). Test-channel release; physical acceptance pending.

## Requested behavior and implemented result
The device now starts on the supplied Dinglehopper still artwork. A small upward chevron and “Swipe up” hint float vertically by 10 pixels. A swipe starting in the lower half (y >= 260), moving upward at least 65 pixels with less than 100 pixels horizontal displacement, opens the dial. Taps and sideways gestures do not open it. The introductory Lottie animation remains disabled. The alignment/tap diagnostic no longer blocks startup; it is available under Settings > Display check.

The dial uses the user's eight supplied SVG icons. They remain upright while their centers orbit at a 176-pixel radius about (240,240). Clockwise order from bottom: Home, Favorites, Wi-Fi, Profile, Settings, Alarm, Explore, Pets. These labels are provisional descriptive names, not claims that those features exist. Settings opens the existing settings screen. Wi-Fi opens the live connection/status screen, with Choose network and Back to dial. Other icons open explicitly labeled “Page preview / This feature is not built yet” screens.

The background, central open control, lower Sand arc, and soft selection halo remain fixed. The icon nearest the bottom becomes Sand. Releasing a drag snaps the ring to the nearest 45-degree position over 180 ms with easing. There is no momentum/inertia in this first test. Icons do not have independent hit boxes that could steal a drag. A single transparent surface handles the gesture. A center press must start and finish inside the 88-pixel radius and move no more than 10 pixels to open a page. A drag that ends in the center cannot open a page. Crossing the center's unstable angle region pauses angle tracking until the finger re-enters the ring. The model normalizes the +/-180-degree seam.

A Sunshine dot follows the Settings wrench when a firmware update is available. The existing Firmware updates button also retains its dot. Selection persists when returning from a page during a session; a new boot begins on Home. Tapping an outer icon to select it is not implemented in this version—rotate the ring.

Wi-Fi starts in the background after the first 1.5 seconds of uptime; startup no longer waits for a Continue tap. Existing saved-credential storage, retry logic, connection timings, and OTA partition layout remain unchanged. The earlier intermittent first-join authentication issue is not claimed fixed by this UI release.

## Brand palette
Use the HEX labels in the supplied palette, not sampled screenshot pixels:

| Color | HEX | UI use |
|---|---|---|
| Forest | #165733 | Reserved brand token |
| Leaf | #6dbf67 | Inactive signal bars |
| Teal | #14b8a6 | Gradient start, connected status, theme accent |
| Sky | #4daaf5 | Gradient end |
| Sunshine | #ffc83d | Available-update dots |
| Coral | #ff6868 | Disconnected/error status |
| Night Sky | #0f1d3a | Icons, text, buttons, inner ring |
| Sand | #f5f1e6 | Selection, glow, button labels, page backgrounds |

The new UI replaces previous blue/sand/status colors with these values. The supplied Dinglehopper illustration is retained as artwork, not globally recolored. The LCD uses RGB565 (5/6/5-bit channels); exact source hex values necessarily quantize to available panel values. Deterministic ordered dithering softens gradient banding. Icon masks use alpha edges. The gradient and halo are pre-rendered, avoiding live blur work and large per-frame allocations. The word “open” is a pre-rendered bold text asset; labels use the existing Montserrat LVGL fonts.

## Source, dependencies, and build
`source.zip` contains the complete firmware sketch and board drivers, generated RGB565 assets, the original supplied SVG icons/reference, asset generator, `lv_conf.h`, all regression test source, and build instructions. `dial-home.png`, `dial-explore.png`, `opener.png`, and `settings.png` are actual host LVGL renders with a circular mask, not photographs or measured hardware results.

New code is in `DialMotion.h` (gesture model), `DialUI.h` (LVGL screens and animations), and `DialAssets.cpp/.h` (generated data). Changes in the sketch route startup/navigation, initialize the theme, start Wi-Fi independently of the old diagnostic gate, and apply palette values to controls. CloudUpdate.h's installed version is 0.1.12.

Use Arduino-ESP32 3.0.2 with the previously validated 3.0.2-h XIP-on-PSRAM/64-byte cache SDK and LVGL 8.3.10. Board options: ESP32-S3, 16 MB flash, OPI PSRAM, qio flash, **USB CDC on boot disabled** (`CDCOnBoot=default`), app maximum 4194304 bytes. Keep the supplied 10 MHz display driver configuration. The known working wall-power configuration is preserved. This is an app-only OTA release: NVS, saved Wi-Fi, and filesystem are not erased. Stable channel remains withheld.

## Verification performed
- Native gesture model: all eight selections, angle seam normalization, rotation direction, center taps, canceled gestures, and drag-to-center opening guard.
- Actual LVGL host input simulation: swipe-up opens dial; a clockwise quarter turn settles to Explore; center tap opens its preview; Settings and Wi-Fi route correctly; drag ending at center stays on dial; 100 repeated opener/menu screen transitions complete with 37,584 bytes free in the 48 KB LVGL heap. This measures the host UI allocator, not whole-device memory or frame rate.
- Host renders visually reviewed: default and rotated dial, supplied opener, preview, and Settings. Icons stay upright, all controls fit the circular display, and update dots use Sunshine.
- Existing production-extraction network harness: failure/retry timing, three-attempt bound, watchdog, stale local disconnect handling, saved credentials, failed replacement preservation, scan exclusion/priority, recovery, and timer wraparound.
- Existing local OTA harness: authorization/token gates, success/reboot, missing-end/error/abort handling.
- Hosted OTA harness: actual parser and downloader with mocked HTTP/flash, checking catalog/version/origin/board/layout/size and successful verification plus corrupt/interrupted/wrong-length/TLS/write/finalization/Wi-Fi-loss cases.
- ESP32-S3 compilation, binary size/header validation, and release catalog hash/byte-count tests. Exact build output accompanies this document.

The host tests do not prove real touchscreen sensitivity, animation smoothness, flash performance, or Wi-Fi reception. The device test below is the release acceptance gate.

## Device acceptance test
1. On existing firmware, connect Wi-Fi and open Settings > Firmware updates > Check for updates. Install 0.1.12 with power connected.
2. Confirm startup goes straight to the Dinglehopper artwork with a gently moving upward hint. Confirm no tap-test screen or Lottie animation appears.
3. Swipe upward from the lower half. Confirm the dial appears. Rotate both directions, including a full circle. Each icon should stay upright; release should settle one icon at the bottom, with Sand highlight and glow.
4. Drag across/into the center and release: no page should open. Then deliberately tap the center: the selected page should open. Check several slow drags and reversals.
5. Rotate the wrench to the bottom and tap open. Confirm Wi-Fi, Firmware updates, signal, Forget Wi-Fi, Display check, and Back remain usable. Do not use Forget unless deliberately testing credential removal.
6. Rotate Wi-Fi to the bottom and open it. Confirm current status and saved connection; choose a network if necessary. Return to the dial.
7. Open other icons and confirm they are clearly marked previews. Return without losing the selected item.
8. After installation has completed, unplug/replug the wall-powered device. Confirm the opener and saved Wi-Fi reconnect. Confirm Firmware updates still checks successfully.
9. Report any display shifting, clipped icons, wrong selection, touch lag, accidental opens, or reboot. Physical smoothness and reconnect success remain pending until this report.
