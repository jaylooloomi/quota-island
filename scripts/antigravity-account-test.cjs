const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-account-'));
  const env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  const launch=()=>electron.launch({args:['scripts/antigravity-account-e2e-main.cjs','--test-mode'],env});
  let app=await launch();
  try{
    let page=await app.firstWindow();await page.locator('#mini-gemini').filter({hasText:'25%'}).waitFor({state:'attached'});
    await page.locator('#toggle').click();await page.locator('#tab-accounts').click();
    await page.locator('.card.gemini .account-switch').click();
    await page.waitForFunction(()=>!document.querySelector('#mini-gemini').textContent.includes('%'));
    assert.equal(await app.evaluate(()=>globalThis.__AG_OPENED),1);
    assert.equal((await page.evaluate(()=>window.quota.getState())).providers.gemini.reading,null,'Old quota must clear while waiting');
    await app.evaluate(()=>{globalThis.__AG_ACCOUNT='second@example.invalid';});
    await page.locator('#mini-gemini').filter({hasText:'75%'}).waitFor({state:'attached',timeout:30000});
    if(await page.locator('.card.gemini .close-connection').isVisible())await page.locator('.card.gemini .close-connection').click();
    await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/antigravity-account-controls.png'});
    await page.locator('.card.gemini .account-logout').click();
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.enabled.gemini,false);
    await page.evaluate(()=>window.quota.refresh());
    assert.equal((await page.evaluate(()=>window.quota.getState())).providers.gemini.reading,null);
    await app.close();app=await launch();page=await app.firstWindow();
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.enabled.gemini,false);
    assert.equal(await app.evaluate(()=>globalThis.__AG_OPENED),0);
    await page.locator('#toggle').click();await page.locator('#tab-accounts').click();
    assert.equal(await page.locator('.card.gemini .account-switch').isEnabled(),true);
    await page.locator('.card.gemini .account-switch').click();
    await page.locator('#mini-gemini').filter({hasText:'25%'}).waitFor({state:'attached',timeout:30000});
    const report={passed:true,checks:['account switch opens official app','old account quota cleared','different account automatically refreshes','disconnect clears quota and blocks refresh','disconnect survives restart','reconnect remains available'],mode:'isolated local-service fixture'};
    await fs.writeFile('test-results/antigravity-account.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
