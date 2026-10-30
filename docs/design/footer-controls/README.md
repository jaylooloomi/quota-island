# Footer controls — 0.5.0

The existing layout and dimensions remain unchanged. Account management stays
in the top Accounts tab; the footer's duplicate account shortcut is removed.

- Language: an in-place menu with four native-language names, a checked current
  choice, immediate switching, arrow-key navigation and focus restoration.
- Sync: per-provider status and last synchronization, safe errors and retry
  countdowns, ordered like the cards. Manual refresh uses the existing polling
  gate, so Retry-After and debounce still apply. Background and top-toolbar
  refreshes also report the refreshing state without hiding existing readings.
- Settings: keeps the original Quota/Accounts context when closed.
- Popovers are exclusive, close on outside pointer or Escape, and do not enlarge
  the window. Opening settings closes them.

Packaged Windows checks passed for all four languages: switching, checked
choice, focus, exclusivity, outside close, settings return to Accounts, cooldown
details and refresh action. The existing desktop, ordering, design and fixture
authorization suites passed. 53 core tests and coverage gate passed. Screenshots
here use demo data, not real account identities or credentials.
