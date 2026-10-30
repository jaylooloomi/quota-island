const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Poller } = require('../dist/poller');
const { ProviderError } = require('../dist/model');
const reading = provider => ({ provider, plan: null, windows: [{ id: 'a', label: 'A', usedPercent: 23, resetsAt: null }], source: 'fixture' });
test('in-flight deduplication and refresh cooldown prevent request storms', async () => {
  let now = 1000000, calls = 0, resolve;
  const p = new Poller(id => { calls++; return new Promise(r => resolve = () => r(reading(id))); }, () => {}, () => now);
  const first = p.refresh('claude'); const second = p.refresh('claude'); assert.equal(calls, 1); resolve();
  await Promise.all([first, second]); await p.refresh('claude'); assert.equal(calls, 1);
  assert.equal(p.states.claude.status, 'ready');
});
test('Retry-After is respected by manual refresh; provider failures are independent', async () => {
  let now = 1000000, calls = { claude: 0, gemini: 0, codex: 0 };
  const p = new Poller(async id => { calls[id]++; if (id === 'claude') throw new ProviderError('rate_limit', 'wait', 600000); return reading(id); }, () => {}, () => now);
  await p.tick(); assert.equal(p.states.codex.status, 'ready'); assert.equal(p.states.claude.status, 'unavailable');
  now += 599999; await p.refresh('claude'); assert.equal(calls.claude, 1);
  now++; await p.refresh('claude'); assert.equal(calls.claude, 2);
});
test('network failure marks previous data stale; auth failure clears a previous account reading', async () => {
  let now = 1000000, failure = null;
  const p = new Poller(async id => { if (failure) throw failure; return reading(id); }, () => {}, () => now);
  await p.refresh('codex'); now += 120000;
  failure = new ProviderError('network', 'offline'); await p.refresh('codex'); assert.equal(p.states.codex.status, 'stale'); assert.equal(p.states.codex.reading.windows[0].usedPercent, 23);
  now += 120000; failure = new ProviderError('auth', 'expired'); await p.refresh('codex'); assert.equal(p.states.codex.status, 'signed_out'); assert.equal(p.states.codex.reading, null); assert.equal(p.states.codex.updatedAt, null);
});
test('disabled sources do not poll, including while a result is in flight', async () => {
  let calls = 0, done;
  const p = new Poller(id => { calls++; return new Promise(resolve => { done = () => resolve(reading(id)); }); }, () => {});
  p.setEnabled('gemini', false); await p.refresh('gemini'); assert.equal(calls, 0);
  const job = p.refresh('claude'); p.setEnabled('claude', false); done(); await job; assert.equal(p.states.claude.reading, null);
});
test('auth completion allows immediate refresh after a previous auth failure', async () => {
  let signedIn = false;
  const p = new Poller(async id => { if (!signedIn) throw new ProviderError('auth', 'login'); return reading(id); }, () => {});
  await p.refresh('codex'); signedIn = true; await p.authenticated('codex'); assert.equal(p.states.codex.status, 'ready');
});
test('manual refresh obtains fresh data after its short debounce without waiting for the automatic polling interval',async()=>{
  let now=1000000,calls=0;
  const p=new Poller(async id=>{calls++;return reading(id);},()=>{},()=>now);
  await p.refresh('codex');await p.refresh('codex',true);assert.equal(calls,1);
  now+=5000;await p.refresh('codex',true);assert.equal(calls,2);
});
test('manual refresh cannot bypass a provider Retry-After',async()=>{
  let now=1000000,calls=0;
  const p=new Poller(async()=>{calls++;throw new ProviderError('rate_limit','wait',600000);},()=>{},()=>now);
  await p.refresh('gemini');now+=10000;await p.refresh('gemini',true);assert.equal(calls,1);
  now+=590000;await p.refresh('gemini',true);assert.equal(calls,2);
});
test('persisted Retry-After survives a new poller instance and expires automatically',async()=>{
  let now=1000000,calls=0;
  const p=new Poller(async id=>{calls++;return reading(id);},()=>{},()=>now);
  p.restoreRateLimits({claude:{until:now+3600000,message:'provider cooldown'}});
  await p.refresh('claude',true);assert.equal(calls,0);assert.equal(p.states.claude.status,'unavailable');
  assert.equal(p.rateLimits().claude.until,now+3600000);
  now+=3600000;await p.refresh('claude');assert.equal(calls,1);assert.deepEqual(p.rateLimits(),{});
});

test('successful reauthorization preserves quota cooldown and resumes at its deadline',async()=>{
  let now=1000000,calls=0;
  const p=new Poller(async id=>{calls++;return reading(id);},()=>{},()=>now);
  const deadline=now+3600000;
  p.restoreRateLimits({claude:{until:deadline,message:'HTTP 429'}});
  await p.authenticated('claude');
  assert.equal(calls,0);
  assert.equal(p.states.claude.nextPollAt,deadline,'Login must not erase the displayed retry deadline');
  assert.equal(p.states.claude.status,'unavailable');
  await p.refresh('claude',true);assert.equal(calls,0);
  now=deadline;await p.refresh('claude');
  assert.equal(calls,1);assert.equal(p.states.claude.status,'ready');
});

test('sign-out clears in-flight old account readings without changing another provider',async()=>{
  let finish;
  const p=new Poller(id=>id==='claude'?new Promise(resolve=>finish=()=>resolve(reading(id))):Promise.resolve(reading(id)),()=>{});
  await p.refresh('gemini');const gemini=structuredClone(p.states.gemini);
  const request=p.refresh('claude');const logout=p.signedOut('claude');
  finish();await request;await logout;
  assert.equal(p.states.claude.status,'signed_out');assert.equal(p.states.claude.reading,null);
  assert.equal(p.states.claude.updatedAt,null);assert.deepEqual(p.states.gemini,gemini);
});
