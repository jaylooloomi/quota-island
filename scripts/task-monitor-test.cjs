const {_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {record}=require('../src/ui/task-hook.cjs');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quota-task-ui-')),output='test-results/task-monitor';await fs.mkdir(output,{recursive:true});
  const events=path.join(dir,'.quota-pebble/task-events');record({session_id:'fixture-running',turn_id:'t',hook_event_name:'PreToolUse',cwd:'D:/projects/Quota Pebble'},events);
  record({session_id:'fixture-waiting',turn_id:'t',hook_event_name:'PermissionRequest',cwd:'D:/projects/Review'},events);
  const env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;let app;
  try{
    app=await _electron.launch({...(process.env.QUOTA_PACKAGED_EXE?{executablePath:process.env.QUOTA_PACKAGED_EXE}:{}),args:[...(process.env.QUOTA_PACKAGED_EXE?[]:['.']),'--demo','--test-mode'],env});
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.quota&&document.querySelector('#mini-codex').textContent.includes('%'));
    await page.locator('#toggle').click();await page.waitForTimeout(150);
    const rect=()=>page.locator('.panel-header').boundingBox(),before=await rect();const quotaPosition=await page.locator('.card[data-provider="claude"]').boundingBox();
    const quotaTime=(await page.evaluate(()=>quota.getState())).providers.codex.updatedAt;
    await page.locator('#tab-tasks').click();await page.waitForFunction(()=>document.querySelectorAll('.task-row').length===2);assert.equal(await page.locator('.task-row[data-status="running"]').count(),1);assert.equal(await page.locator('.task-row[data-status="waiting"]').count(),1);assert.equal(await page.locator('#cards').isVisible(),false);
    await page.screenshot({path:output+'/overview.png'});
    const data=await page.evaluate(()=>quota.getState());data.tasks.rows.push({id:'unsafe',title:'<img src=x onerror="window.HACKED=1">',project:'D:/'+('long project ').repeat(35),status:'unknown',source:'history',confirmedAt:null});
    await app.evaluate(({BrowserWindow},data)=>BrowserWindow.getAllWindows()[0].webContents.send('state',data),data);
    assert.equal(await page.locator('#task-panel img').count(),0);assert.equal(await page.evaluate(()=>window.HACKED),undefined);
    for(const locale of ['zh-TW','en','ja','ko']){
      data.settings.locale=locale;await app.evaluate(({BrowserWindow},data)=>BrowserWindow.getAllWindows()[0].webContents.send('state',data),data);await page.waitForTimeout(100);
      assert.equal(await page.locator('#tab-tasks svg use').getAttribute('href'),'#i-tasks',locale+' task icon survives translation');
      assert.equal(await page.locator('#task-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,locale+' panel fits');
      const header=await rect();assert.ok(Math.abs(header.width-before.width)<1);assert.ok(Math.abs(header.height-before.height)<1);await page.screenshot({path:output+'/'+locale+'.png'});
    }
    await page.locator('.task-filters button').nth(1).click();assert.equal(await page.locator('.task-row').count(),1);
    await page.locator('#tab-tasks').focus();await page.keyboard.press('Home');await page.waitForTimeout(150);assert.equal(await page.locator('#tab-quota').getAttribute('aria-selected'),'true');
    const after=await page.locator('.card[data-provider="claude"]').boundingBox();for(const key of ['x','y','width','height'])assert.ok(Math.abs(after[key]-quotaPosition[key])<=1,'quota geometry '+key);
    assert.equal((await page.evaluate(()=>quota.getState())).providers.codex.updatedAt,quotaTime,'task monitor never refreshes quota');
    data.settings.locale='zh-TW';data.tasks.liveCoverage=false;data.tasks.connection='runtime';data.tasks.rows=data.tasks.rows.map(r=>({...r,status:'unknown'}));data.tasks.counts={running:0,waiting:0,idle:0,unknown:data.tasks.rows.length};
    await app.evaluate(({BrowserWindow},data)=>BrowserWindow.getAllWindows()[0].webContents.send('state',data),data);await page.locator('#tab-tasks').click();assert.equal(await page.locator('.task-counts strong').first().innerText(),'—');assert.match(await page.locator('.task-notice').first().innerText(),/未接上/);
    await page.screenshot({path:output+'/source-unconnected.png'});
    await page.locator('.task-summary-setting input').check();
    await page.evaluate(()=>quota.settings({petRoam:true,petPlacement:'stage'}));
    const compactGeometry=()=>page.locator('.compact-provider').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}));
    await page.locator('#collapse').click();await page.waitForTimeout(100);await page.locator('#roam-pet').waitFor({state:'visible',timeout:20000});assert.equal((await page.evaluate(()=>quota.getState())).settings.petRoam,true,'stage companion preference preserved');const compact=await compactGeometry();assert.equal(await page.locator('.compact-task-summary').isVisible(),true);
    await page.locator('#toggle').click();await page.locator('.task-summary-setting input').uncheck();await page.locator('#collapse').click();await page.waitForTimeout(100);const original=await compactGeometry();for(let i=0;i<compact.length;i++)for(const k of ['x','y','w','h'])assert.ok(Math.abs(compact[i][k]-original[i][k])<1,'compact summary fixed '+k);
    assert.deepEqual(errors,[]);console.log('PASS task UI: real Electron, hook fixtures, four locales, XSS, keyboard, fixed geometry and no quota calls');
  }finally{if(app)await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
