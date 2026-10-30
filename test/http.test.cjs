const { test } = require('node:test');
const assert = require('node:assert/strict');
const { jsonRequest, retryDelay } = require('../dist/http');
test('HTTP failures use safe messages and honor Retry-After seconds and dates', async () => {
  assert.equal(retryDelay('300'), 300000);
  assert.equal(retryDelay('Fri, 30 Oct 2026 12:10:00 GMT', Date.parse('2026-10-30T12:00:00Z')), 600000);
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(jsonRequest('https://example.invalid', {}, async () => new Response('SECRET TOKEN', { status, headers: { 'retry-after': '180' } })), e => {
      assert.ok(!e.message.includes('SECRET')); assert.equal(e.code, status === 429 ? 'rate_limit' : status === 500 ? 'network' : 'auth');
      if (status === 429) assert.equal(e.retryAfterMs, 180000); return true;
    });
  }
});
test('invalid JSON and network errors never surface raw response bodies', async () => {
  await assert.rejects(jsonRequest('https://example.invalid', {}, async () => new Response('TOKEN')), { code: 'schema' });
  await assert.rejects(jsonRequest('https://example.invalid', {}, async () => { throw new Error('Authorization: SECRET'); }), e => e.code === 'network' && !e.message.includes('SECRET'));
});
