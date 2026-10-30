// Read-only account verification after signing into the normal desktop app.
// Google token refresh may update only the app's own encrypted credential copy.
const { app, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { mkdtempSync } = require('node:fs');
const { Providers } = require('../dist/providers');
const { Gemini, GeminiVault } = require('../dist/gemini');
app.setName('quota-island');
app.setPath('userData', path.join(app.getPath('appData'), 'quota-island'));
// A simultaneous normal app owns its Chromium disk cache. Keep this headless
// diagnostic's session separate while using the same encrypted account vault.
app.setPath('sessionData', mkdtempSync(path.join(app.getPath('temp'), 'quota-island-account-check-')));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const providers = new Providers(new Gemini(new GeminiVault(app.getPath('userData'), safeStorage)), ()=>'antigravity');
  try {
    let cooldowns={};try{cooldowns=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'provider-cooldowns.json'),'utf8'));}catch{}
    const results = await Promise.all(['claude', 'gemini', 'codex'].map(async id => {
      if(cooldowns[id]?.until>Date.now())return [id,{status:'unavailable',code:'rate_limit',error:cooldowns[id].message,retryAt:new Date(cooldowns[id].until).toISOString()}];
      try {
        const reading = await providers.read(id);
        return [id, { status: 'ready', windows: reading.windows, source: reading.source }];
      } catch (e) { return [id, { status: e.code === 'auth' ? 'signed_out' : 'unavailable', code: e.code, error: e.message }]; }
    }));
    await fs.mkdir(path.join(__dirname, '../test-results'), { recursive: true });
    const report = JSON.stringify({ checkedAt: new Date().toISOString(), providers: Object.fromEntries(results) }, null, 2);
    await fs.writeFile(path.join(__dirname, '../test-results/accounts.json'), report);
    console.log(report);
  } finally { providers.close(); app.quit(); }
}).catch(() => { console.error('Account verification failed; no credential details logged.'); app.exit(1); });
