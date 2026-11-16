# Startup connection follow-up — November 15, 2026 (America/Chicago)

User-reported result following the requested original-location startup test: initial connection seems to take a couple of attempts, then connects. Signal remains approximately -63 dBm.

Classification: eventual saved-network connection succeeded; first-attempt reliability remains unresolved. Exact attempt count, elapsed time, reason codes for the unsuccessful attempts, installed version, and long-term connection duration were not separately recorded in this report. Do not infer a prolonged stability pass or three repeated power-cycle passes.

The observed connected RSSI is in the diagnostic's Good category. It does not measure conditions throughout the failed handshake attempts, interference, or the router's received signal; no root cause is established. Avoid treating this as proof that either antenna range or firmware is the sole cause.

Next development priority: capture per-attempt disconnect reasons and elapsed connection time, distinguish association/security-handshake completion from IP acquisition, and compare repeated starts before changing retry or radio settings. No firmware, transmit-power, power-saving, credential or router changes made in response to this observation.
