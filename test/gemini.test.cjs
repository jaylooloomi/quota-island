const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Gemini, GeminiVault, matchingState } = require('../dist/gemini');
test('Google OAuth callback requires matching state and uses PKCE before saving credentials', async () => {
  let saved, visited;
  const vault = { load: async () => null, save: async data => saved = data };
  const client = { generateCodeVerifierAsync: async () => ({ codeVerifier: 'verifier', codeChallenge: 'challenge' }),
    generateAuthUrl: options => { assert.equal(options.code_challenge_method, 'S256'); assert.equal(options.code_challenge, 'challenge'); return 'https://accounts.google.com/auth?' + new URLSearchParams(options); },
    getToken: async options => { assert.equal(options.code, 'TEST-CODE'); assert.equal(options.codeVerifier, 'verifier'); return { tokens: { access_token: 'TEST-TOKEN' } }; } };
  const g = new Gemini(vault, () => client);
  let browserDone;
  const browser = new Promise((resolve, reject) => browserDone = { resolve, reject });
  const login = g.login(async url => {
    try {
      visited = new URL(url);
      const callback = new URL(visited.searchParams.get('redirect_uri'));
      callback.searchParams.set('code', 'TEST-CODE'); callback.searchParams.set('state', 'forged');
      assert.equal((await fetch(callback)).status, 400); assert.equal(saved, undefined);
      callback.searchParams.set('state', visited.searchParams.get('state'));
      const response = await fetch(callback); assert.equal(response.status, 200); await response.text(); browserDone.resolve();
    } catch (e) { browserDone.reject(e); throw e; }
  }, 3000);
  await Promise.all([login, browser]); assert.equal(saved.access_token, 'TEST-TOKEN'); assert.equal(g.server, null);
});
test('Google OAuth cancellation and timeouts close the loopback callback', async () => {
  const client = { generateCodeVerifierAsync: async () => ({ codeVerifier: 'a', codeChallenge: 'b' }), generateAuthUrl: () => 'https://accounts.google.com' };
  const g = new Gemini({ load: async () => null, save: async () => {} }, () => client);
  await assert.rejects(g.login(async () => {}, 30), { code: 'auth' }); assert.equal(g.server, null);
  assert.equal(matchingState('abc', 'abc'), true); assert.equal(matchingState('abc', 'abd'), false); assert.equal(matchingState('abc', null), false);
});
test('Gemini encrypted vault refuses plaintext fallback and does not persist raw tokens', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'quota-vault-'));
  try {
    const encryption = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value).map(b => b ^ 0xaa), decryptString: value => Buffer.from(value).map(b => b ^ 0xaa).toString() };
    const vault = new GeminiVault(dir, encryption, path.join(dir, 'no-legacy'));
    assert.equal(await vault.load(), null);
    await vault.save({ access_token: 'SECRET-TEST-TOKEN', refresh_token: 'REFRESH' });
    assert.ok(!(await readFile(path.join(dir, 'gemini-session.bin'))).includes(Buffer.from('SECRET-TEST-TOKEN')));
    assert.equal((await vault.load()).access_token, 'SECRET-TEST-TOKEN');
    const insecure = new GeminiVault(dir, { ...encryption, getSelectedStorageBackend: () => 'basic_text' });
    await assert.rejects(insecure.save({ access_token: 'X' }), { code: 'auth' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('Gemini queries metadata and model quota only and saves rotated tokens', async () => {
  let saved; const methods = [];
  const client = { credentials: {}, setCredentials(value) { this.credentials = value; }, async getAccessToken() { this.credentials.access_token = 'NEW'; }, async request(options) {
    methods.push(options.url.split(':').pop());
    return { data: methods.length === 1 ? { cloudaicompanionProject: 'project', currentTier: { name: 'Pro' } } : { buckets: [{ modelId: 'gemini-pro', remainingFraction: .75 }] } };
  } };
  const g = new Gemini({ load: async () => ({ access_token: 'OLD', refresh_token: 'R' }), save: async c => saved = c }, () => client);
  const reading = await g.read(); assert.equal(reading.windows[0].usedPercent, 25); assert.equal(saved.access_token, 'NEW'); assert.equal(saved.refresh_token, 'R');
  assert.deepEqual(methods, ['loadCodeAssist', 'retrieveUserQuota']);
});
