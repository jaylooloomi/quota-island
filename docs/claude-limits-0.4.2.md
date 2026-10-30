# Claude quota comparison — 0.4.2

The website showed **used** 12% session / 15% weekly all models / 20% Fable.
The app's default **remaining** view correctly showed 88% / 85%, but omitted
Fable. The first two percentages were complements, not conflicting readings.

A read-only provider response inspection on 2026-10-31 confirmed that Fable
appears in the newer `limits` array, while the legacy flat scoped-model fields
are null. The old parser only read flat objects with `utilization` and therefore
missed the scoped limit. No browser cookie scraping or fabricated quota was used.

Supported modern shape:

- `kind: session`, `group: session`, `percent`, `resets_at`.
- `kind: weekly_all`, `group: weekly`, `percent`, `resets_at`.
- `kind: weekly_scoped`, `scope.model.display_name`, optional surface,
  `percent`, `resets_at`.

The parser prefers valid modern rows, deduplicates their legacy counterparts,
and fills absent rows from legacy data. `is_active: false` does not remove a
displayable limit: the provider's website still shows those rows. Null
percentages remain unknown; extra spending/billing utilization is not a quota
window. Different scoped model/surface windows are preserved independently.

The UI labels session / weekly all models / scoped model explicitly, adds a
remaining-or-used caption beside each provider, and keeps three Claude windows
visible without scrolling in the normal three-provider layout. Exact reset
timestamps remain available on hover. Known plan metadata is displayed when
provided; it is not inferred from the screenshot.

Validation: 53 Node tests passed; four-language packaged-app tests assert
88/85/80 remaining and 12/15/20 used, full untruncated window labels, and no
scrollbar required for the six-window reference scenario. Existing desktop,
design and authorization integration suites passed. A final packaged live
check read the three Claude windows successfully, along with Gemini/Codex.

The committed screenshot uses synthetic reference data, not a saved credential
or a dump of the real provider response.
