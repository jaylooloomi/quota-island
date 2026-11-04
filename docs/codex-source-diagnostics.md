# Codex source diagnostics — 2026-11-04

## Reported issue

The work PC installed the latest published GitHub release, v1.28.2. Its remote task monitor is identical to the v1.29.1 monitor previously running on the home PC, so version age alone does not explain missing tasks.

The home PC reader and existing app both observed three running local Codex chats. This does not establish what the work PC can read. The work PC's own diagnostics have not yet been collected.

## Confirmed defects and changes in v1.29.2

- A usable controller socket previously marked the remote source available even if every host task query failed. Per-host errors were swallowed. A readable local source also made the aggregate Codex badge look connected.
- The local Codex badge now explicitly identifies the local source. A separate expandable remote source section displays each host and its query result.
- Online + RPC_TIMEOUT is explicitly described as an unresponsive task service, not zero running tasks. Unsupported/unloaded runtime states remain unknown.
- Recheck now awaits remote scanning when it starts a scan and can retry repaired local authorization. Existing in-progress scans are not duplicated. Server HTTP 429 cooldown cannot be bypassed; Retry-After is honored.
- Copy diagnostics exports only version, machine name, source health, bounded counts, timestamps and safe error codes. No task titles, project paths, environment IDs, tokens, raw responses or conversation content are copied.

## Verification

- 215 unit tests passed, including online-host query failure, recovered host status, unloaded runtime, cooldown preservation and diagnostic redaction.
- Real Electron UI regression: four locales × four source states; widths fit; copy diagnostics IPC exercised; clipboard text restored after the test.
- Existing task panel regression passed: fixed header, three-row task viewport, filters, metadata layout and no quota calls.
- These source-health failure/recovery tests are fixtures. They do not establish that the work PC's missing three tasks have recovered.

## Next evidence

Update the work PC, open Tasks → Remote sources → Copy diagnostics, and share the report. The actual work-PC failure may be authorization, task-service connection, timeout or unsupported runtime state; do not assume which without its report.
