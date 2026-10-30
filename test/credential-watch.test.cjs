const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { CredentialWatch } = require('../dist/credential-watch');
test('new or changed credentials trigger automatic refresh once without reading credential contents', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'quota-watch-'));
  try {
    const file = path.join(dir, 'auth.json'), changed = [];
    const watcher = new CredentialWatch({ claude:[file] }, async id => { changed.push(id); });
    await watcher.scan(); assert.deepEqual(changed, []);
    await writeFile(file, 'fixture'); await watcher.scan(); await watcher.scan();
    assert.deepEqual(changed, ['claude']);
    await writeFile(file, 'updated-credentials-fixture'); await watcher.scan();
    assert.deepEqual(changed, ['claude','claude']);
  } finally { await rm(dir, {recursive:true,force:true}); }
});
