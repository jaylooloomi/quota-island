const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Poller } = require('../dist/poller');
const { Connections } = require('../dist/connections');
const { ProviderError } = require('../dist/model');
const { claudeLoginProgress } = require('../dist/claude-login');
test('browser completion automatically clears auth backoff, fetches quota, publishes and focuses app', async () => {
  let connected = false, complete, calls = 0, focused = 0, published = 0;
  const poller = new Poller(async provider => { calls++; if (!connected) throw new ProviderError('auth', 'login'); return { provider, windows: [{ id:'x', label:'test', usedPercent:42 }], plan:null, source:'fixture' }; }, () => { published++; });
  await poller.refresh('gemini');
  const service = { login: async () => new Promise(resolve => { complete = () => { connected = true; resolve(); }; }), submitCode() {} };
  const connection = new Connections(service, poller, async () => {}, () => published++, () => focused++);
  const job = connection.login('gemini'); assert.equal(connection.states.gemini.pending, true);
  complete(); await job;
  assert.equal(calls, 2); assert.equal(poller.states.gemini.reading.windows[0].usedPercent, 42);
  assert.equal(connection.states.gemini.phase, 'ready'); assert.equal(focused, 1); assert.ok(published > 3);
});
test('successful authorization with unavailable quota reports a sync failure instead of pretending connected', async () => {
  const p = new Poller(async () => { throw new ProviderError('network', 'provider offline'); }, () => {});
  const c = new Connections({ login: async () => {}, submitCode(){} }, p, async () => {}, () => {}, () => {});
  await c.login('claude'); assert.equal(c.states.claude.phase, 'error'); assert.match(c.states.claude.message, /配額同步失敗.*provider offline/);
});
test('Claude authorization-code route remains in-app and is refreshed once after CLI completion', async () => {
  let end, provided;
  const p = new Poller(async provider => ({ provider, windows:[], plan:null, source:'fixture' }), () => {});
  const c = new Connections({ login: async (_id, _open, progress) => { progress({ codeRequired:true, browserUrl:'https://claude.com/cai/oauth/authorize?state=FIXTURE' }); await new Promise(r => end = r); }, submitCode(_id, code) { provided = code; end(); } }, p, async () => {}, () => {}, () => {});
  const job = c.login('claude'); assert.equal(c.states.claude.phase, 'code');
  assert.ok(!JSON.stringify(c.states).includes('state=FIXTURE'));
  c.submitCode('claude', 'TEST-CODE'); await job;
  assert.equal(provided, 'TEST-CODE'); assert.equal(c.states.claude.phase, 'ready');
});
test('Claude parser recognizes the live CLI manual redirect and never forwards arbitrary links', () => {
  assert.equal(claudeLoginProgress('Open https://claude.com/cai/oauth/authorize?redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback\n').codeRequired, true);
  assert.deepEqual(claudeLoginProgress('diagnostic https://evil.example/oauth/authorize'), {});
});
