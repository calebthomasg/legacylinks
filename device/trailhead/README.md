# Dinglehopper · Home and Settings v0.1.16

Source for the Waveshare ESP32-S3-Touch-LCD-2.8C, carried forward from the Petopia source candidate based on the v0.1.12 dial. The Pets entry reads four independently selectable layers on a 240 × 240 canvas. Coat-specific patterns follow the coat. The original embedded cat provides the fallback. Save cat commits all four traits together to internal flash. A restart restores the last explicitly saved combination. The SD card still supplies the artwork.

## Home and Settings

Home uses eight fixed touch targets based on the supplied vectors. Settings rows open directly and fade with distance from the center as the list scrolls. Back preserves the list position. The interface uses Nunito and a repeating four-pixel-high dithered strip of the supplied gradient for the round RGB565 display.

The device picks one of 20 greetings at boot and avoids repeating the previous greeting. Time syncs over Wi-Fi and uses US Central time with daylight saving. After sync the firmware writes UTC to the onboard clock for offline startup while the clock retains power. An invalid clock displays a waiting state. Battery bars are approximate voltage bands using the vendor divider calibration. The Battery page shows measured voltage. Brightness persists on slider release, and Storage reports used and free space on the mounted FAT volume.

Confirm direct taps, scroll smoothness, row selection throughout the fade, brightness after restart, storage readings, and offline clock retention on hardware. Account, Friends, and Trailhead are entry-point previews. Clock currently displays local time.

## Card layout

Run `python3 tools/pack_petopia.py OUTPUT/trailhead/petopia` (Pillow required) or use the prepared card folder. Copy just the petopia subfolder into the existing trailhead directory. Petopia opens the files for reading. The intro, manifest, and opening image are independent of this screen.

The v0.1.0 sketch and Waveshare 2.8C Arduino SD example use one-bit SD_MMC with CLK 2, CMD 1, D0 42 and EXIO4 high. The display finishes its command sequence and releases LCD chip select before Petopia requests those pins. Screen refresh uses the separate RGB interface. Mounting is deferred until Pets opens and automatic formatting is disabled. A failed read returns to the built-in cat. Retry card remounts after a read failure. Only the current cropped layers occupy external RAM. Each layer starts with PET1, followed by four little-endian 16-bit fields (x, y, width, height), then three bytes per pixel (RGB565 little-endian, alpha).

## Rebuild and test

Use Arduino CLI, Arduino-ESP32 3.0.2, LVGL 8.3.10, Python with esptool 4.6 dependencies, and the matching Espressif SDK. Verify the SDK archive SHA-256 before extracting it.

- SDK archive: https://dl.espressif.com/AE/esp-dev-kits/esp32-3.0.2-h.tar.xz
- SDK SHA-256: d6c90bb22ff219e4bf56c802f6c0eb7a2880ec7a342054c8d1283f2a53f97b13
- LVGL commit: 06e229cc7679c01119ca5d905a1f9dad96f475f0
- Export LVGL_PATH to the LVGL checkout and PETOPIA_SDK to the extracted directory containing esp32s3/. Run `sh tools/build.sh`. Use only rebuilt/TrailheadFirstBoot.ino.bin for application updates.
- From this directory run each of tests/run-network-tests.py, tests/run-ota-tests.py, tests/run-cloud-tests.py, and tests/run-dial-tests.py with Python 3. The last uses LVGL_PATH and Pillow. Cloud tests use system OpenSSL and cJSON.
- The web repository's release catalog and byte integrity tests run with `node --test scripts/test-firmware.mjs` from repository root.

## Hardware acceptance

v0.1.14 coat cycling passed on the user’s Dinglehopper. This observation covers the coat fix.

v0.1.15 save and restore passed on the Dinglehopper. The owner saved a custom combination, powered the device off, and confirmed the same cat returned after powering it on.

Pending card-removal check: with power off, remove the card, boot once, then power down to reinstall it. Confirm the saved cat returns.

Use Settings → Firmware updates to install test-channel builds. On wall power, confirm a clean boot and saved Wi-Fi reconnect. Open Pets, change each feature, mix coat and pattern, and return via Back to dial. Repeat after a restart. Test the embedded fallback by powering down, removing the card, and rebooting. Power down before reinserting the card. Check the screen for drift and touch offset, and verify Settings, Wi-Fi, local upload, and Check for updates. Check GPS separately in the workflow actually used with the prototype. The supplied sketch has no GNSS receiver driver. Record observations before promoting this image.

The fallback USB recovery procedure may be needed if the application cannot boot. The repository's existing OTA implementation does not automatically roll back a valid but nonbooting image.
