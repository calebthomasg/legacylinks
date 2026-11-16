# Wi-Fi signal observation — November 15, 2026 (America/Chicago)

Evidence: user-reported observation after the v0.1.10 diagnostic release was provided; installed version was not separately reconfirmed in this report.

User reports signal is great next to the router, then approximately -63 dBm after moving to the original problem location. No numeric near-router reading, visit min/max, observation duration or disconnect count was supplied.

The diagnostic's heuristic classifies -63 dBm as Good (three bars). This measures device-received signal at that moment; it does not establish the cause of earlier reason-204 join failures or demonstrate reliable joining from startup at this location.

Next controlled physical test: once no update is in progress, power-cycle at the original location using the same working power supply/cable; tap Continue and Open, allow saved-network connection attempts to finish, and record automatic-join result and any exact failure reason. Preserve saved credentials and radio configuration. If one attempt succeeds, repeat twice to evaluate reproducibility. No firmware or radio setting changes made for this observation.
