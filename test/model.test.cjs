const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseClaude, parseCodex, parseGemini, percent, iso } = require('../dist/model');
test('missing percentages never become zero, malformed numbers are rejected', () => {
  for (const value of [null, undefined, '', '20', NaN, Infinity, -1, 101]) assert.equal(percent(value), null);
  assert.equal(percent(0), 0); assert.equal(percent(100), 100);
  assert.equal(iso(null), null); assert.equal(iso('invalid'), null); assert.equal(iso(Infinity), null);
});
test('Claude accepts all provider-defined windows and ignores nulls and extra billing', () => {
  const r = parseClaude({ five_hour: { utilization: 0, resets_at: null }, seven_day: null, seven_day_new: { utilization: 62.5, resets_at: '2026-11-01T00:00:00Z' }, extra_usage: { used_credits: 4 } });
  assert.equal(r.windows.length, 2); assert.equal(r.windows[0].usedPercent, 0);
  assert.equal(r.windows[1].usedPercent, 62.5); assert.equal(r.windows[1].resetsAt, '2026-11-01T00:00:00.000Z');
  assert.throws(() => parseClaude({ five_hour: { utilization: null } }), { code: 'schema' });
});
test('Codex preserves named limits and server-defined window durations', () => {
  const r = parseCodex({ rateLimitsByLimitId: { codex: { primary: { usedPercent: 24, windowDurationMins: 300, resetsAt: 1800000000 }, secondary: { usedPercent: 50, windowDurationMins: 10080 } }, review: { limitName: 'Review', primary: { usedPercent: 0, windowDurationMins: 43200 } } }, rateLimits: { primary: { usedPercent: 99 } } });
  assert.equal(r.windows.length, 3); assert.equal(r.windows[0].label, '5 小時');
  assert.equal(r.windows[1].label, '7 天'); assert.equal(r.windows[2].label, 'Review · 30 天');
  assert.equal(r.windows[0].resetsAt, '2027-01-15T08:00:00.000Z');
});
test('Codex legacy rateLimits fallback and unknown quota', () => {
  assert.equal(parseCodex({ rateLimits: { primary: { usedPercent: 12 } } }).windows[0].usedPercent, 12);
  assert.throws(() => parseCodex({}), { code: 'schema' });
});
test('Gemini converts remaining to used, preserves every model and does not coerce missing values', () => {
  const r = parseGemini({ buckets: [{ modelId: 'gemini-pro', remainingFraction: .85, resetTime: '2026-11-01T00:00:00Z' }, { modelId: 'gemini-flash', remainingFraction: 0 }, { modelId: 'unknown', remainingFraction: null }, { remainingFraction: '1' }, { remainingFraction: 1.1 }] });
  assert.equal(r.windows.length, 2); assert.equal(r.windows[0].usedPercent, 15); assert.equal(r.windows[1].usedPercent, 100);
  assert.throws(() => parseGemini({ buckets: [{ modelId: 'pro' }] }), { code: 'schema' });
});
