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

test('Claude modern limits include Fable and override duplicate legacy totals',()=>{
  const reading=parseClaude({five_hour:{utilization:99},seven_day:{utilization:99},seven_day_sonnet:null,
    limits:[{kind:'session',group:'session',percent:12,is_active:false,resets_at:'2026-11-01T00:00:00Z'},
      {kind:'weekly_all',group:'weekly',percent:15,is_active:false,resets_at:'2026-11-04T13:59:59Z'},
      {kind:'weekly_scoped',group:'weekly',percent:20,is_active:true,scope:{model:{id:null,display_name:'Fable'},surface:null},resets_at:'2026-11-04T13:59:59Z'}],extra_usage:{utilization:42}},'team');
  assert.equal(reading.windows.length,3);assert.deepEqual(reading.windows.map(row=>row.usedPercent),[12,15,20]);
  assert.deepEqual(reading.windows.map(row=>row.label),['本次工作階段','每週 · 所有模型','Fable · 每週']);
  assert.equal(reading.plan,'team');assert.equal(reading.windows[2].resetsAt,'2026-11-04T13:59:59.000Z');
  assert.deepEqual(reading.windows.map(row=>100-row.usedPercent),[88,85,80]);
});

test('Claude fills missing modern windows from legacy and preserves model/surface scope',()=>{
  const reading=parseClaude({five_hour:{utilization:12},seven_day_sonnet:{utilization:33},
    limits:[null,{kind:'session',percent:null},{kind:'weekly_all',percent:15},{kind:'weekly_all',percent:88},
      {kind:'weekly_scoped',percent:20,scope:{model:{display_name:'Fable'},surface:{display_name:'Web'}}},
      {kind:'weekly_scoped',percent:25,scope:{model:{display_name:'Fable'},surface:{display_name:'Code'}}},
      {kind:'custom_window',percent:50},{kind:'weekly_scoped',percent:1,scope:{surface:{display_name:'App'}}},
      {kind:'weekly_scoped',percent:2}]});
  assert.equal(reading.windows.length,8);
  assert.ok(reading.windows.some(row=>row.label==='Fable · Web · 每週'));
  assert.ok(reading.windows.some(row=>row.label==='Fable · Code · 每週'));
  assert.ok(reading.windows.some(row=>row.label==='custom window'));
  assert.ok(reading.windows.some(row=>row.label==='Sonnet · 每週'));
  assert.equal(reading.windows.find(row=>row.id==='seven_day').usedPercent,15);
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
