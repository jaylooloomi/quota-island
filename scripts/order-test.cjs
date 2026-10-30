const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'quota-order-'));
  const env = { ...process.env, QUOTA_TEST_DATA:directory }; delete env.ELECTRON_RUN_AS_NODE;
  // Upgrade from the old design should start in the requested Remaining mode.
  await fs.writeFile(path.join(directory,'preferences.json'),JSON.stringify({remaining:false}));
  const executablePath = process.env.QUOTA_PACKAGED_EXE;
  const launch = () => electron.launch({ ...(executablePath ? {executablePath} : {}), args:[...(executablePath ? [] : ['.']), '--demo','--test-mode'], env });
  let application;
  const compactOrder = page => page.locator('.provider-strip .compact-provider').evaluateAll(nodes => nodes.map(n => n.dataset.provider));
  const cardOrder = page => page.locator('#cards .card').evaluateAll(nodes => nodes.map(n => n.dataset.provider));
  try {
    application = await launch(); let page = await application.firstWindow();
    await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();
    assert.deepEqual(await compactOrder(page),['claude','codex','gemini'],'Default order follows the requested provider order');
    await page.locator('.compact-provider.codex').dragTo(page.locator('.compact-provider.claude'));
    await page.waitForFunction(() => document.querySelector('.provider-strip').firstElementChild.dataset.provider === 'codex');
    assert.deepEqual(await compactOrder(page), ['codex','claude','gemini']);
    assert.equal(await page.locator('#panel').isVisible(), false, 'Dragging must not expand the island');
    await page.locator('#toggle').click();
    assert.deepEqual(await cardOrder(page), ['codex','claude','gemini']);
    // Expanded cards use the same shared order.
    await page.locator('.card.gemini .card-heading').dragTo(page.locator('.card.codex .card-heading'));
    await page.waitForFunction(() => document.querySelector('.provider-strip').firstElementChild.dataset.provider === 'gemini');
    assert.deepEqual(await cardOrder(page), ['gemini','codex','claude']);
    await page.locator('#collapse').click();
    await page.locator('.compact-provider.claude').focus(); await page.keyboard.press('Alt+ArrowLeft');
    await page.waitForFunction(() => document.querySelectorAll('.provider-strip .compact-provider')[1].dataset.provider === 'claude');
    assert.deepEqual(await compactOrder(page), ['gemini','claude','codex']);
    // IPC rejects malformed or incomplete orders, without losing providers.
    await page.evaluate(() => window.quota.settings({order:['claude','claude','codex']}));
    assert.deepEqual(await compactOrder(page), ['gemini','claude','codex']);
    const prefs = JSON.parse(await fs.readFile(path.join(directory,'preferences.json'),'utf8'));
    assert.deepEqual(prefs.order, ['gemini','claude','codex']);
    await application.close(); application = await launch(); page = await application.firstWindow();
    await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();
    assert.deepEqual(await compactOrder(page), ['gemini','claude','codex']);
    assert.deepEqual(await cardOrder(page), ['gemini','claude','codex']);
    await fs.mkdir('test-results',{recursive:true}); await page.mouse.move(0,0);
    await page.screenshot({path:'test-results/island-reordered.png'});
    await page.locator('#toggle').click();await page.locator('#mode-used').click();await page.locator('#mode-used[aria-pressed="true"]').waitFor();
    await application.close();application=await launch();page=await application.firstWindow();
    await page.locator('#mini-codex').filter({hasText:'88%'}).waitFor();
    assert.deepEqual(await compactOrder(page),['gemini','claude','codex']);
    const report={passed:true,packaged:!!executablePath,checks:['compact drag reorder','drag does not trigger expand','card drag reorder','shared compact and expanded order','Alt+arrow keyboard reorder','invalid order rejected','order saved to preferences','order restored after restart']};
    await fs.writeFile('test-results/order.json',JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
  } finally {if(application) await application.close();await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
