# Task idle notifications (v1.24.0)

The blue idle card is a status update, not a successful-completion claim. The
existing green Codex completion card continues to require explicit success proof.

An eligible task must be observed running today (local calendar day), then idle
for at least 30 seconds with at least two distinct, fresh observations. Repeated
renders of the same cached snapshot cannot advance the gate. Each observed
activity cycle can notify once. Notifications have a 10-minute per-task cooldown
and a 60-second global cooldown; suppressed cycles are dropped, not queued later.

Initial idle records, missing rows, unknown/stale sources, interruptions in
observation, waiting states, pause/disabled notifications and reconnect baselines
do not generate old idle alerts. Running after a baseline establishes a new
eligible activity. Successful completion suppresses the corresponding idle
alert; if success proof arrives after a blue card, green replaces it immediately.

Sources are the existing local Codex records, authorized Codex remote metadata,
Claude process-verified registry and Antigravity local RPC. No new CLI, Hooks,
provider quota requests or private receivers are introduced. Claude/Antigravity
currently support idle alerts, not verified-success announcements.

The shared **Completion / idle alerts** setting controls both types. Cards remain
visible for 12 seconds, pause dismissal on hover, can be closed, and open the
corresponding task on View task. The main window dimensions do not change. The
arrow anchors to the corresponding provider where visible. Chinese, English,
Japanese and Korean are supported.

Tests: `npm test`, `node scripts/task-idle-bubble-test.cjs`,
`node scripts/task-bubble-test.cjs`. The idle UI test feeds isolated local fixture
events through the actual monitor and waits the full 30-second gate. Native
provider transition logic is covered with deterministic fixtures; this does not
claim a naturally running Claude or Antigravity task was observed completing.
