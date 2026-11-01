const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'quota-island-live-'));
  if(process.platform==='win32'&&process.env.APPDATA){try{await fs.copyFile(path.join(process.env.APPDATA,'quota-island','provider-cooldowns.json'),path.join(userData,'provider-cooldowns.json'));}catch{/* No prior provider Retry-After. */}}
  const env = { ...process.env, QUOTA_TEST_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.QUOTA_PACKAGED_EXE;
  const application = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : ['.']), '--test-mode'], env, timeout: 30000 });
  try {
    const page = await application.firstWindow();
    const deadline = Date.now() + 60000;
    while (true) {
      const current = await page.evaluate(() => window.quota.getState());
      if (Object.values(current.providers).every(p => p.status !== 'loading')) break;
      if (Date.now() > deadline) throw new Error('Providers did not finish initial refresh');
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const result = await page.evaluate(async () => {
      const state = await window.quota.getState();
      return Object.fromEntries(Object.entries(state.providers).map(([id, s]) => [id, { status: s.status, error: s.error, updatedAt: s.updatedAt, windows: s.reading?.windows ?? [], source: s.reading?.source ?? null }]));
    });
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile('test-results/live.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await page.locator('#toggle').click(); await page.locator('#panel').waitFor({ state: 'visible' });
    await page.screenshot({ path: 'test-results/island-live.png' });
    if(await page.locator('.card.gemini .quota-details-link').isVisible()){
      await page.locator('.card.gemini .quota-details-link').click();
      await page.screenshot({path:'test-results/antigravity-live-details.png'});
    }
  } finally { await application.close(); await fs.rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
