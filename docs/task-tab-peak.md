# Task tab running peak — v1.26.0

Applies proposal 01 (numbers side by side) to the task tab only. Three equal
cards share label/value baselines: Running shows current / peak with an explicit
Peak label; Waiting and Idle show current counts with secondary descriptions.
The compact island summary is unchanged. All four locales are supported.

The record is the highest observed **simultaneous running** count, not a capacity
limit, cumulative task total, or reconstructed historical number. It includes
only connected monitored sources and at most the current 100-row monitoring
scope. Unknown, idle, waiting, stale/future observations and duplicate rows do
not increase it; pause/disconnect never lowers or clears an existing peak.

`task-peak.json` stores count, observation time and recording start only, using
an atomic write on record changes. No task titles, project paths or identifiers
are saved. The value survives restart; a missing/invalid record starts unknown
until a valid observation. A write error preserves the in-memory peak and is
reported in the running card's tooltip, with later writes retried. Demo/test
records are isolated in `demo-task-peak.json`.

Tests cover monotonicity, restart persistence, stale/unknown/duplicate handling,
write recovery, real local scan integration, equal card geometry in four locales,
100 / 100 layout, and unchanged compact summary. Screenshots with 2 / 13 use
isolated demo data and are not the user's historical measurements.
