const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-pacing-'));
  const env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});
  let app=await launch();
  try{
    let page=await app.firstWindow();await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();await page.locator('#toggle').click();
    const send=s=>app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('state',state),s);
    const shape=()=>page.locator('.card').evaluateAll(nodes=>({width:innerWidth,height:innerHeight,rows:nodes.map(el=>{const r=el.getBoundingClientRect(),heading=el.querySelector('.card-heading').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,headingX:heading.x};})}));
    for(const locale of ['zh-TW','en','ja','ko']){
      await page.evaluate(locale=>window.quota.settings({locale,pacing:false,remaining:true}),locale);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const base=await shape();
      await page.locator('#mode-pacing').click();
      await page.waitForFunction(()=>document.querySelector('#mode-pacing').getAttribute('aria-pressed')==='true');
      assert.deepEqual(await shape(),base,`${locale}: pacing must preserve every card and window dimension`);
      const state=await page.evaluate(()=>window.quota.getState()),fixture=structuredClone(state);
      for(const [id,remaining] of [['claude',62],['codex',80],['gemini',34]]){
        Object.assign(fixture.providers[id],{status:'ready',updatedAt:new Date().toISOString(),reading:{provider:id,plan:id==='claude'?'Team':'Pro',windows:[{id:'seven_day',label:'每週 · 所有模型',usedPercent:100-remaining,resetsAt:new Date(Date.now()+4*86400000).toISOString()}],source:'Test fixture'}});
      }
      fixture.providers.gemini.reading.windows[0].group='Gemini Models';
      await send(fixture);await page.locator('.card.codex .pace-value').filter({hasText:'17.5'}).waitFor();
      assert.equal(await page.locator('.pacing-content:not([hidden])').count(),3);
      for(const row of await page.locator('.pacing-content').evaluateAll(nodes=>nodes.map(el=>({text:el.textContent,width:el.clientWidth,scroll:el.scrollWidth,segments:[...el.querySelectorAll('.pace-segment')].map(s=>parseFloat(s.style.width))})))){
        assert.ok(row.scroll<=row.width+1,`${locale}: pacing row overflow`);assert.ok(row.text.includes('10%'));assert.ok(!row.text.includes('10 點'));assert.equal(row.segments.reduce((a,b)=>a+b,0),100);
      }
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
      assert.equal(await page.locator('.panel-header').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Header must fit three modes');
      await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/pacing-${locale}.png`});
      const invalid=structuredClone(fixture);invalid.providers.codex.reading.windows[0].resetsAt=null;await send(invalid);
      assert.equal(await page.locator('.card.codex .pace-value').textContent(),'—','Missing reset must not invent guidance');
      const stale=structuredClone(fixture);stale.providers.codex.status='stale';await send(stale);assert.equal(await page.locator('.card.codex .pace-value').textContent(),'—');
      await page.evaluate(()=>window.quota.settings({pacing:true}));
      await page.locator('.card.codex .pace-link').click();await page.locator('#pace-details').waitFor();
      assert.match(await page.locator('#pace-details-title').textContent(),/Codex/,'Detail title must match selected provider');
      await page.locator('#pace-reserve').fill('20');await page.locator('#pace-reserve').dispatchEvent('change');
      await page.waitForFunction(()=>document.querySelector('#pace-reserve-value').textContent==='20%');
      const saved=await page.evaluate(()=>window.quota.getState());assert.equal(saved.settings.reservePercent.codex,20);
      const selected=await page.locator('#pace-window').inputValue();await page.locator('#pace-window').selectOption(selected);
      assert.equal((await page.evaluate(()=>window.quota.getState())).settings.paceWindows.codex,selected);
      await page.screenshot({path:`test-results/pacing-${locale}-details.png`});
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${locale}: detail must fit`);
      await page.locator('#close-pace-details').click();await page.locator('#mode-used').click();
      assert.equal(await page.locator('.pacing-content:not([hidden])').count(),0);
      await page.evaluate(()=>window.quota.settings({reservePercent:{codex:10}}));
    }
    await page.evaluate(()=>window.quota.settings({pacing:true,reservePercent:{codex:25}}));
    await page.evaluate(()=>window.quota.settings({reservePercent:{codex:-1,claude:101},pacing:'invalid'}));
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.reservePercent.codex,25);
    await app.close();app=await launch();page=await app.firstWindow();
    const saved=await page.evaluate(()=>window.quota.getState());assert.equal(saved.settings.pacing,true);assert.equal(saved.settings.reservePercent.codex,25);assert.ok(saved.settings.paceWindows.codex);
    const report={passed:true,packaged:!!executablePath,checks:['three modes preserve row and window dimensions','four-language pacing and details fit','reserve percentage and independent quota segments','missing reset and stale data suppress advice','reserve and window preferences persist','invalid preferences rejected']};
    await fs.writeFile('test-results/pacing.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
