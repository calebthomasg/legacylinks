# Trailhead hosted update test channel

This additive change serves firmware and a small release catalog from the LegacyLink website. It does not modify database tables or normal site pages.

- `/firmware/trailhead/test.json`: prototype test release, firmware 0.1.9.
- `/firmware/trailhead/stable.json`: deliberately no release until physical acceptance.
- `/firmware/trailhead/releases/<version>/trailhead-<version>-app.bin`: immutable ESP32-S3 app image (not a factory image).

The v0.1.8 bootstrap firmware must first be installed through the device's existing local uploader. It then checks the test catalog over verified HTTPS, offers v0.1.9, downloads on user confirmation, verifies size/SHA256, selects the inactive OTA slot and restarts. v0.1.9 keeps this feature. Same or older versions are not offered. The bootstrap package contains full firmware source, tests, build details and hardware test instructions.

Board: Waveshare ESP32-S3-Touch-LCD-2.8C. Layout identifier: `trailhead-16m-ota4m-v1` (4 MB slots at 0x10000 and 0x410000). Keep USB CDC disabled and the established 64-byte cache/XIP SDK. Wi-Fi credentials remain in NVS.

## Preparing another release

Build and inspect the app image, increment its compiled version, then run from the repo root:

```
node scripts/publish-firmware.mjs test 0.1.10 /absolute/path/trailhead-0.1.10-app.bin "Brief release notes"
node --test scripts/test-firmware.mjs
```

The helper validates ESP32-S3 chip ID, app size, numeric version and notes; computes the actual digest and rejects changed bytes for an existing version. It prepares local files; publishing occurs through the normal Git/deployment workflow. Review the compiled version independently: the publisher does not infer the firmware's displayed version from its bytes. Never publish a factory image. Do not publish credentials or device-specific identifiers.

After deployment, check both catalog and binary return HTTP 200 without redirects/auth; download both through `https://www.legacylinks.io`; compare binary length and SHA256. ESP firmware requires Content-Length and identity encoding. Catalog is no-store; versioned binaries are immutable. Publish bytes and catalog in one deployment. Old published binaries should remain available.

## Acceptance and rollback limits

Verify v0.1.8 badge, details, manual install progress, restart into v0.1.9, saved Wi-Fi, wall-power restart, no further update offered, unavailable-server message and local recovery upload. Record timings and exact failures. These are physical tests still pending at development time.

Transport uses TLS certificate verification plus SHA256, not independently signed firmware. Failed/incomplete downloads do not select the new slot. Automatic recovery from a valid but non-booting new image is not enabled; USB recovery may be necessary. Stable release and larger deployments should follow signed-firmware/rollback work and physical validation.

## Documentation

Changes and tests for the device are documented in the companion v0.1.8 development package. This repository records the server implementation and release artifacts. Neither a successful build nor a mocked test is a physical pass.
