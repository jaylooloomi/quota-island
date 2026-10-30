# Four-language and sign-in review — 2026-10-31

Version 0.3.1, Windows, Original Dark, 480 × 640 expanded window.

## Findings and fixes

- Authorization-code verification previously shared the five-minute browser
  authorization timeout, had no cancel control, and displayed the quota
  cooldown beneath an unfinished login. This could look like one stuck operation.
- Code submission now starts a separate 60-second verification timeout.
  Expiry rejects the login with a retry message and terminates its child process.
  Cancel is available during Claude browser authorization and code verification.
- The consumed CLI prompt buffer is cleared after submission. Unrelated subsequent
  output no longer reopens the previous authorization-code prompt.
- Verification is a separate state in the progress indicator. Successful
  authorization with an active quota cooldown is explicitly shown as authorized,
  waiting for quota sync; it is not reported as a login failure.
- Pending authorization no longer shows the old quota retry countdown as its
  connection instruction. Quota cooldown itself remains enforced.
- Settings rows, code form controls and account actions can wrap safely;
  translated long text cannot extend horizontally beyond the panel.

## Checks

All four locales were checked: Traditional Chinese, English, Japanese, Korean.

| Screen/state | Verification |
|---|---|
| Normal quota cards and remaining/used switch | No scrolling required for three demo cards; switch labels stay on one line |
| Settings | Locale/source selectors, toggles and actions stay inside the panel |
| All three provider account details | Translated instructions, source details, login controls |
| Claude code entry | Input and submit button fit; cancel remains accessible |
| Claude verifying code | Explicit 60-second message, no duplicate code form, cancel available |
| Authorized but quota cooling down | No false login-error styling; sign-in management remains available |
| Verification timeout | Translated error, enabled retry action |
| Restart | Selected locale and provider ordering persist |

Node suite: **49 passed**, measured loaded modules **87.77% lines,
85.91% branches, 89.47% functions**. The percentages exclude Electron entrypoints
and do not represent whole-app coverage. Coverage scope: [test-coverage.md](test-coverage.md).

Windows packaged-app suites: four-language audit, design, desktop controls and
ordering. Authorization integration additionally tests real Electron IPC,
cancel/retry, callback server and child stdin using fixture provider responses.
Real provider browser authorization and upstream availability cannot be certified
by those fixtures. A read-only local Claude CLI status check reported signed in;
that does not prove a particular new account switch succeeded. No extra quota
queries were made to bypass the existing rate limit.

Screenshots and the audit report are in [design/review-0.3.1](design/review-0.3.1).
macOS and Linux have not been verified on physical devices.
