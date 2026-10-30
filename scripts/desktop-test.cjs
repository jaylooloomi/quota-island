const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'quota-island-e2e-'));
  const env = { ...process.env, QUOTA_TEST_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.QUOTA_PACKAGED_EXE;
  const application = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : ['.']), '--demo', '--test-mode'], env, timeout: 30000 });
  const errors = [];
  try {
    const page = await application.firstWindow(); page.on('pageerror', e => errors.push(e.message));
    await page.locator('#mini-claude').filter({ hasText: '36%' }).waitFor();
    assert.equal(await page.locator('#panel').isVisible(), false);
    const compact = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    assert.equal(compact.width, 464); assert.equal(compact.height, 76);
    const compactBarHeight=await page.locator('.bar').evaluate(el=>el.getBoundingClientRect().height);
    await page.locator('#toggle').click(); await page.locator('#panel').waitFor({ state: 'visible' });
    const expanded = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    assert.equal(expanded.width, 464); assert.ok(expanded.height>=480&&expanded.height<560);
    assert.ok(Math.abs(await page.locator('.panel-header').evaluate(el=>el.getBoundingClientRect().height)-compactBarHeight)<0.01,'Expanded title area must match the compact island bar height');
    assert.equal(await page.locator('.card').count(), 3); assert.equal(await page.locator('.quota-row').count(), 5);
    await page.locator('#mode-used').click(); await page.locator('#mini-claude').filter({ hasText: '64%' }).waitFor({state:'attached'});
    assert.match(await page.locator('#mode-label').textContent(), /已用/);
    await page.locator('#mode-remaining').click(); await page.locator('#mini-claude').filter({ hasText: '36%' }).waitFor({state:'attached'});
    await fs.mkdir('test-results', { recursive: true });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: 'test-results/island-expanded.png' });
    // Security boundaries: the renderer has no Node globals or arbitrary IPC primitive.
    assert.deepEqual(await page.evaluate(() => ({ require: typeof require, process: typeof process, ipc: typeof window.quota.invoke })), { require: 'undefined', process: 'undefined', ipc: 'undefined' });
    await page.locator('#settings-toggle').click();
    await page.locator('[data-enable="gemini"]').uncheck(); await page.locator('#mini-gemini').filter({ hasText: '暫停' }).waitFor({state:'attached'});
    await page.locator('[data-enable="gemini"]').check(); await page.locator('#mini-gemini').filter({ hasText: '62%' }).waitFor({state:'attached'});
    await page.locator('#alwaysOnTop').uncheck();
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop()), false);
    await page.locator('#settings-toggle').click();
    await page.locator('.card.claude .connection-status').click();
    await page.locator('.card.claude .login').click(); await page.locator('.card.claude .auth-message').filter({ hasText: '展示模式' }).waitFor();
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.locator('#panel').waitFor({ state: 'hidden' });
    await page.screenshot({ path: 'test-results/island-compact.png' });
    await page.locator('#toggle').click();
    await page.locator('#settings-toggle').click(); await page.locator('#hide').click();
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    const preferences = await fs.readdir(userData); assert.ok(!preferences.includes('gemini-session.bin'));
    const encryption = await application.evaluate(({ safeStorage }) => {
      const available = safeStorage.isEncryptionAvailable();
      const backend = safeStorage.getSelectedStorageBackend?.() ?? 'platform-default';
      if (!available || backend === 'basic_text') return { available, backend, roundTrip: false };
      const encrypted = safeStorage.encryptString('QUOTA-TEST-NOT-A-REAL-TOKEN');
      return { available, backend, roundTrip: safeStorage.decryptString(encrypted) === 'QUOTA-TEST-NOT-A-REAL-TOKEN', rawTokenAbsent: !encrypted.includes(Buffer.from('QUOTA-TEST-NOT-A-REAL-TOKEN')) };
    });
    if (process.platform === 'win32' || process.platform === 'darwin') {
      assert.equal(encryption.available, true); assert.equal(encryption.roundTrip, true); assert.equal(encryption.rawTokenAbsent, true);
    }
    assert.deepEqual(errors, []);
    const metrics = await application.evaluate(({ app }) => {
      const processes = app.getAppMetrics();
      return { processCount: processes.length, workingSetMiB: Math.round(processes.reduce((sum, p) => sum + p.memory.workingSetSize, 0) / 1024) };
    });
    const summary = { passed: true, packaged: !!executablePath, checks: ['compact/expanded dimensions', 'three provider cards', 'five reference quota windows', 'used/remaining toggle', 'provider enable/disable', 'always on top', 'demo blocks login', 'Escape collapses', 'tray hide/restore', 'renderer sandbox', 'native credential encryption', 'no renderer errors'], encryption, metrics, screenshots: ['island-expanded.png', 'island-compact.png'] };
    await fs.writeFile(executablePath ? 'test-results/desktop-packaged.json' : 'test-results/desktop.json', JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally { await application.close(); await fs.rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
})().catch(e => { console.error(e); process.exitCode = 1; });

