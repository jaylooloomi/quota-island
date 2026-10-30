# Test coverage — 2026-10-30

Run `npm run test:coverage`. The command rebuilds TypeScript, runs the Node
test suite, saves `test-results/coverage.txt`, and fails below 85% lines,
80% branches, or 85% functions. GitHub Actions runs the same gate on
Windows, macOS, and Linux and uploads each coverage report.

Windows local result: **49 tests passed**, **87.77% lines**, **85.91%
branches**, **89.47% functions** across modules loaded by the Node tests.
This is not a whole-application coverage percentage. Node's report includes
the loaded compiled service modules and `src/ui/presentation.js`; it does
not count unimported files as zero coverage. In particular `main.ts`,
`preload.ts`, `providers.ts`, and renderer `app.js` are not represented in
this percentage. Electron tests exercise those integration paths separately.

Quota parsing, polling/backoff, credential watching, connection state, CLI
discovery, HTTP handling, and presentation helpers have 100% line coverage.
Claude login has 96.43%, Gemini OAuth 85.12%, and Codex RPC 86.60%.
Antigravity's unit line coverage remains 49.12%: native process discovery
and platform-specific probes are an outstanding gap. Branch coverage is
also lower for Google OAuth and platform-specific CLI discovery. These
limits should guide future tests, rather than excluding these modules to
inflate totals.

Additional Windows suites:

- `npm run test:auth`: real Electron IPC, callback server, child-process
  authorization-code handling, encrypted storage, and automatic UI update;
  upstream OAuth/quota responses are test fixtures.
- `npm run test:desktop`: dimensions, visibility, modes, settings, sandbox,
  native encryption, and renderer errors.
- `npm run test:order`: drag/keyboard ordering and restart persistence.
- `npm run test:design`: compact content overlap, heading separation,
  scrollbar-free quota cards, numeric/bar consistency, login progress,
  disconnected/stale states, and rate-limit handling.
- `npm run test:i18n`: all four languages, immediate switching, restart
  persistence, invalid locale rejection, card layout, account controls,
  and rate-limit login/countdown translation. The shared translation
  catalog and DOM restoration helpers are also covered by Node tests.

The latter three suites were also run against the Windows executable in
`release/00-dark-small/win-unpacked/`. Tests use isolated settings and demo
quotas; they do not bypass provider rate limits or prove real credentials
remain valid. Claude's previous real HTTP 429 remains a separate service
limitation. Local macOS/Linux runs have not been performed; CI results
must be checked after pushing.
