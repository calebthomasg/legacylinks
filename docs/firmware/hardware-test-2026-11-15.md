# Trailhead hardware test — November 15, 2026 (America/Chicago)

Evidence: user-reported physical observations, not directly instrumented by the development environment.

## Results
- Device initially running v0.1.7 failed to join saved Wi-Fi with reason 204.
- Moving next to the router substantially improved connectivity.
- User successfully installed v0.1.8.
- User observed the yellow update-available circle.
- User successfully updated from v0.1.8 to v0.1.9 through the new hosted update flow.

This confirms the first physical success of update discovery and device-initiated hosted installation. It does not establish reliability at the original location. Improved proximity is consistent with a radio-link issue, but does not identify its root cause or exclude firmware involvement.

## Still pending
1. Unplug/replug after completed v0.1.9 installation; confirm v0.1.9 persists and saved Wi-Fi reconnects.
2. Confirm updater reports up to date and yellow badge disappears after checking.
3. Repeat connectivity at increasing distances using the same power setup; record location and connection result. No password re-entry should be necessary.
4. Record download duration and progress behavior; neither was reported in this test.
5. Interruption/recovery testing and broader stable-release acceptance remain pending.

No source or firmware changes were made in response to this report. Stable catalog remains withheld; this result alone does not authorize a broader rollout.
