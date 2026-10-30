# Antigravity grouped limits — 0.6.0

The older adapter read `GetUserStatus` model quotas, filtered to Gemini models,
and grouped equal High/Medium/Low variants. It did not query the newer
`RetrieveUserQuotaSummary` response. That omitted shared weekly/session pools.

The adapter now prefers the measured `response.groups[].buckets[]` summary:
Gemini Models weekly and five-hour, Claude and GPT models weekly and five-hour,
and separate model limits such as Gemini 4 Argon weekly. Unknown/disabled buckets
are not invented as 100%; weekly-only responses remain weekly-only.

Requests use only bounded, discovered process-owned loopback ports, with HTTPS
or local HTTP as required. The TLS exception stays local; CSRF tokens and account
identifiers never reach the renderer. Plan metadata is read from the same source.
If an earlier working source establishes a known account identity, a later richer
response from another account is rejected. Older services retain the measured
Gemini-model fallback.

The main card is labeled Antigravity and shows the two most constrained windows
plus an explicit total count and View all limits action. The full panel preserves
provider groups, remaining/used switching and reset countdowns with exact dates
on hover. Its disclaimer separates Antigravity Claude/GPT quotas from independent
Claude Code/Codex subscriptions. All content fits the existing window.

58 core tests and coverage gates passed. Four-language packaged checks exercise
all five reference buckets, three groups, remaining/used conversion, full-panel
fit and navigation; existing design, desktop and auth integration checks passed.
A packaged live check also returned the real five buckets successfully. Screenshots
committed here are fixtures, not saved credentials or raw account responses.

Upstream implementation reference:
https://github.com/steipete/CodexBar/blob/main/docs/antigravity.md
