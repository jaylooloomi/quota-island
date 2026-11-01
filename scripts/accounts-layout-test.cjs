const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-multi-layout-'));
  const env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});
  try{
    const page=await app.firstWindow();await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.locator('#toggle').click();
    for(const label of ['工作帳號','個人帳號']){
      await page.locator('#add-account-toggle').click();await page.locator('#account-label').fill(label);await page.locator('#add-account-form button[type="submit"]').click();
      const id=(await page.evaluate(()=>window.quota.getState())).accounts.find(a=>a.label===label).id;
      await page.evaluate(()=>window.quota.refresh());await page.locator(`[data-provider="${id}"] .close-connection`).click();
    }
    const state=await page.evaluate(()=>window.quota.getState()),first=state.accounts[0].id;
    for(const locale of ['zh-TW','en','ja','ko']){
      await page.evaluate(locale=>window.quota.settings({locale,pacing:false}),locale);
      await page.locator('#tab-quota').click();
      assert.equal(await page.locator('.card:visible').count(),5);
      assert.equal(await page.locator(`[data-provider="${first}"] h2`).textContent(),'工作帳號','Account names must not be translated into status messages');
      const identity=()=>page.locator(`[data-provider="${first}"]`).evaluate(el=>{const r=el.querySelector('.card-heading').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
      const quota=await identity();await page.locator('#tab-accounts').click();assert.deepEqual(await identity(),quota);
      const actionColumns=await page.locator('.card').evaluateAll(cards=>cards.map(card=>['.account-switch','.account-logout'].map(selector=>{const r=card.querySelector(selector).getBoundingClientRect();return {x:r.x,width:r.width,offsetY:r.y-card.getBoundingClientRect().y};})));
      for(const columns of actionColumns)assert.deepEqual(columns,actionColumns[0],`${locale}: primary account actions share columns and row offset`);
      const card=page.locator(`[data-provider="${first}"]`);
      await card.locator('.rename-account').click();await card.locator('.rename-input').fill('改名測試');await card.locator('.rename-editor button[type="submit"]').click();
      await card.locator('h2').filter({hasText:'改名測試'}).waitFor();
      assert.equal((await page.evaluate(()=>window.quota.getState())).accounts.find(a=>a.id===first).label,'改名測試');
      await card.locator('.rename-account').click();await card.locator('.rename-input').fill('工作帳號');await card.locator('.rename-editor button[type="submit"]').click();
      await card.locator('h2').filter({hasText:'工作帳號'}).waitFor();
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${locale}: five cards and add control must fit`);
      assert.equal(await page.locator('#add-account-toggle').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('footer').getBoundingClientRect().top),true);
      await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/multi-accounts-${locale}.png`});
      await page.locator('#tab-quota').click();await page.locator('#mode-pacing').click();
      assert.equal(await page.locator(`[data-provider="${first}"] .pacing-content`).isVisible(),true);
      await page.locator(`[data-provider="${first}"] .pace-link`).click();assert.match(await page.locator('#pace-details-title').textContent(),/工作帳號/);
      await page.locator(`[data-provider="${first}"] .pace-link`).click();
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('#extra-account-settings label').count(),2);
      const cells=await page.locator('#visible-service-grid label').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,overflow:el.scrollWidth>el.clientWidth+1};}));
      assert.equal(cells.length,5);assert.equal(cells[0].y,cells[1].y);assert.equal(cells[1].y,cells[2].y);assert.equal(cells[3].x,cells[0].x);assert.ok(cells[3].y>cells[0].y);assert.equal(cells[3].y,cells[4].y);assert.equal(cells.some(c=>c.overflow),false,`${locale}: three service switches per row must fit`);
      assert.equal(await page.locator('#enabled-service-grid label').evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().y===nodes[0].getBoundingClientRect().y)),true);
      await page.locator('#extra-account-settings input').first().uncheck();
      await page.locator('#settings-toggle').click();assert.equal(await page.locator(`[data-provider="${first}"]`).isVisible(),false);
      await page.locator('#settings-toggle').click();await page.locator('#extra-account-settings input').first().check();await page.locator('#settings-toggle').click();
    }
    assert.deepEqual(errors,[]);
    const report={passed:true,packaged:!!executablePath,checks:['add control creates independent account cards','five-card layout fits in four languages','custom account names retained','quota/account identity alignment','per-account pace details','individual visibility controls','no renderer errors'],mode:'demo data'};
    await fs.writeFile('test-results/multi-account-layout.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
