const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-multi-'));
  const env={...process.env,QUOTA_TEST_DATA:dir,CLAUDE_CONFIG_DIR:path.join(dir,'primary')};delete env.ELECTRON_RUN_AS_NODE;
  const launch=()=>electron.launch({args:['scripts/accounts-e2e-main.cjs','--test-mode'],env});
  let app=await launch();
  try{
    let page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.stack));
    await page.locator('#toggle').click();
    const add=async name=>{
      await page.locator('#add-account-toggle').click();await page.locator('#account-label').fill(name);await page.locator('#add-account-form button[type="submit"]').click();
      const state=await page.evaluate(()=>window.quota.getState()),id=state.accounts.find(a=>a.label===name).id,card=page.locator(`[data-provider="${id}"]`);
      await card.locator('.auth-code-form').waitFor();await card.locator('.auth-code').fill('MULTI-TEST-CODE');await card.locator('.auth-code-form button').click();
      await page.waitForFunction(id=>document.querySelector(`[data-provider="${id}"]`).classList.contains('ready'),id);
      await card.locator('.close-connection').click();return id;
    };
    const first=await add('Claude 工作'),second=await add('Claude 個人');
    let state=await page.evaluate(()=>window.quota.getState());assert.equal(state.providers[first].reading.windows[0].usedPercent,10);assert.equal(state.providers[second].reading.windows[0].usedPercent,40);
    assert.equal(state.providers.claude.reading,null);assert.equal(state.accounts.length,2);assert.equal(await page.locator('#claude-account-count').textContent(),'3');
    await page.locator(`[data-provider="${second}"] .card-grip`).focus();await page.keyboard.press('Alt+ArrowUp');
    state=await page.evaluate(()=>window.quota.getState());assert.ok(state.settings.order.indexOf(second)<state.settings.order.indexOf(first));
    assert.equal(JSON.stringify(state).includes('TEST-claude-account-'),false);
    const credentialPaths=[first,second].map(id=>path.join(dir,'claude-accounts',id,'.credentials.json'));
    assert.notEqual(await fs.readFile(credentialPaths[0],'utf8'),await fs.readFile(credentialPaths[1],'utf8'));
    await assert.rejects(fs.stat(path.join(dir,'primary','.credentials.json')));
    await page.evaluate(({id})=>window.quota.settings({pacing:true,reservePercent:{[id]:15}}),{id:first});
    state=await page.evaluate(()=>window.quota.getState());assert.equal(state.settings.reservePercent[first],15);assert.equal(state.settings.reservePercent[second],5);
    await page.locator(`[data-provider="${first}"] .pace-link`).click();await page.locator('#pace-details').waitFor();assert.match(await page.locator('#pace-details-title').textContent(),/Claude 工作/);
    await page.locator(`[data-provider="${first}"] .pace-link`).click();
    await page.locator('#tab-accounts').click();await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/multi-claude-accounts.png'});
    await page.locator(`[data-provider="${first}"] .account-logout`).click();await page.locator(`[data-provider="${first}"] .confirm-logout`).click();
    await page.waitForFunction(id=>!document.querySelector(`[data-provider="${id}"]`).classList.contains('ready'),first);
    state=await page.evaluate(()=>window.quota.getState());assert.equal(state.providers[first].reading,null);assert.equal(state.providers[second].status,'ready');
    await assert.rejects(fs.stat(credentialPaths[0]));await fs.stat(credentialPaths[1]);
    assert.equal(await page.locator(`[data-provider="${first}"] .account-switch`).isEnabled(),true);
    await app.close();app=await launch();page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));
    await page.locator('#toggle').click();await page.waitForFunction(id=>document.querySelector(`[data-provider="${id}"]`)?.classList.contains('ready'),second);
    state=await page.evaluate(()=>window.quota.getState());assert.equal(state.accounts.length,2);assert.equal(state.providers[first].reading,null);
    assert.ok(state.settings.order.indexOf(second)<state.settings.order.indexOf(first),'Extra account ordering survives restart');
    await page.locator('#tab-accounts').click();await page.locator(`[data-provider="${first}"] .remove-account`).click();await page.locator(`[data-provider="${first}"] .remove-confirm button`).first().click();
    await page.locator(`[data-provider="${first}"]`).waitFor({state:'detached'});
    assert.equal((await page.evaluate(()=>window.quota.getState())).accounts.length,1);assert.equal(errors.length,0,errors.join('\n'));
    const report={passed:true,checks:['add two Claude accounts through UI and official-CLI-shaped login','isolated config dirs and credential files','two independent live quota readings','primary account untouched','per-account pacing preferences','logout affects only selected profile','restart restores monitoring','remove only selected account','credentials absent from renderer snapshot','no renderer errors'],mode:'isolated CLI and network fixtures'};
    await fs.writeFile('test-results/multi-account.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
