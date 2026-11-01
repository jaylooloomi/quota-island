# Compact Double-layer — 0.4.0

Implemented from proposal 03, with the Quota / Accounts switch from proposal 04.
Screenshots here are the actual packaged Windows renderer with demo data.

- Compact: 464 × 76 including transparent margins; provider mini progress bars,
  visible version, drag grip, refresh and expand.
- Expanded: 616 × 520; flat provider rows, primary quota bar, secondary quota
  chip/bar, full reset dates, header/footer version, language/account/settings
  shortcuts. All server windows remain represented; no fake fixed quotas.
- Accounts: separate provider actions; Claude and Codex can switch and sign out.
  Sign-out requires inline confirmation and affects the corresponding local
  official CLI. A provider's sign-out does not clear another provider's state.
- Gemini personal: launches the installed Antigravity application for account
  management; it does not claim to sign Antigravity out remotely. On Linux or
  if launch fails, the UI asks the user to open Antigravity themselves.
- Only real source metadata is shown. Emails are not inferred or fabricated.
- Existing ordering, language, cooldown and authorization behavior is retained.

Windows checks passed: 51 Node tests; packaged design, four-language settings /
account / sign-in layout, keyboard tab navigation, drag sorting, restart
persistence, renderer sandbox and demo protections. Auth integration uses
fixture provider responses and official-CLI-shaped child processes to exercise
the actual IPC and dispatch paths for switching, canceling, confirming logout,
clearing old readings and preserving another provider's state. It does not sign
out the user's real accounts. Native macOS/Linux operation remains unverified.

Measured loaded-module coverage: 88.04% lines, 85.84% branches, 89.63% functions;
not whole-app coverage. See ../../test-coverage.md for scope.
