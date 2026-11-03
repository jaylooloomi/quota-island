# Relative usage trends (v1.23.0)

The selected design is `design/trend-scale-proposals/03-relative-change.svg`.
Existing quota cards stay unchanged; expanding Usage trends reveals the controls,
step chart and summary below the quota row.

- Default range: rolling 8 hours. Other ranges: 1 day, 7 days and 30 days.
- Default scale: relative change in percentage points, with an adaptive vertical
  axis. Absolute mode retains the actual used quota on a fixed 0–100% axis.
- Each continuous segment starts at its first available reading. The summary
  compares the first and last readings in the **latest** segment only.
- Resets, corrections and data gaps break the line and establish a new baseline.
  They are not subtracted across segments. Missing data is never filled with zero.
- A single reading shows an unknown change, rather than claiming zero usage.
- These are observed quota percentages, not token counts. Scale changes use
  already loaded history and do not trigger provider requests.
- Account/window selections remain independent; existing history retention and
  raw readings are unchanged. All controls support Chinese, English, Japanese
  and Korean, including keyboard chart inspection.

## Smart tooltip (v1.24.2)

The existing dark floating card evaluates all four chart corners. Avoiding the
inspected point has priority, followed by the density of plotted readings. A
score margin keeps the previous corner when differences are small; moving onto
the selected point overrides this hysteresis. No connector curve is drawn and
the chart's height is unchanged. Both scales and keyboard inspection use the
same positioning logic. Positions use measured tooltip dimensions, including
translated text. Very dense data can still be covered, as noted in proposal 03.
Placement scoring samples at most 500 readings per candidate.

Validation: `npm test`, `npm run test:trends`,
`QUOTA_TRENDS_SMALL_SCREEN=1 node scripts/usage-trends-test.cjs`, and
`npm run test:relative-trends`. The last test uses isolated demo readings
(70% → 76%), verifies +6.0 percentage points, both scales, four locales,
keyboard tooltips and independent account baselines. Screenshots are demo data.
