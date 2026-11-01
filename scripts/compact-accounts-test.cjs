const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-carousel-')),env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});
  try{
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();
    const added=await page.evaluate(()=>window.quota.addAccount('Claude 個人'));assert.equal(added.ok,true);const id=added.id;await page.evaluate(()=>window.quota.refresh());
    const snapshot=await page.evaluate(()=>window.quota.getState()),fixture=structuredClone(snapshot);
    for(const [key,used] of [['claude',15],[id,65]])Object.assign(fixture.providers[key],{enabled:true,status:'ready',updatedAt:new Date().toISOString(),reading:{provider:'claude',source:'carousel fixture',plan:'Pro',windows:[{id:'five_hour',label:'5 小時',usedPercent:1,resetsAt:new Date(Date.now()+3600000).toISOString()},{id:'seven_day',label:'每週 · 所有模型',usedPercent:used,resetsAt:new Date(Date.now()+4*86400000).toISOString()}]}});
    fixture.expanded=false;fixture.settings.remaining=true;
    // Keep deterministic fixture snapshots while exercising the real renderer timers.
    await app.evaluate(({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].webContents;global.carouselSend=wc.send.bind(wc);wc.send=(channel,...args)=>channel==='state'?undefined:global.carouselSend(channel,...args);});
    const send=state=>app.evaluate((_electron,s)=>global.carouselSend('state',s),state);
    await send(fixture);await page.mouse.move(0,0);
    const claude=page.locator('.compact-provider.claude'),badge=page.locator('#claude-account-count');
    // Observe both manual refresh IPC and the native periodic poll timestamps.
    await app.evaluate(({ipcMain})=>{const original=ipcMain._invokeHandlers.get('refresh');global.carouselRefreshes=0;ipcMain.removeHandler('refresh');ipcMain.handle('refresh',(...args)=>{global.carouselRefreshes++;return original(...args);});});
    const shape=()=>page.locator('.bar,.compact-provider,#toggle,#compact-refresh').evaluateAll(nodes=>({width:innerWidth,height:innerHeight,rects:nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})}));
    const baseline=await shape();assert.equal(baseline.width,464);assert.equal(baseline.height,76);
    assert.equal(await badge.textContent(),'1/2');assert.equal(await page.locator('#mini-claude').textContent(),'85%');
    await claude.click();assert.equal(await badge.textContent(),'2/2');assert.equal(await page.locator('#mini-claude').textContent(),'35%');
    assert.match(await claude.getAttribute('title'),/Claude 個人/);assert.match(await claude.getAttribute('title'),/35%/);assert.match(await claude.getAttribute('title'),/\d{4}/);
    assert.equal(await claude.locator('.mini-track span').evaluate(el=>el.style.width),'35%');assert.deepEqual(await shape(),baseline);
    // A hover must pause for longer than a complete rotation interval.
    await claude.hover();await page.waitForTimeout(5500);assert.equal(await badge.textContent(),'2/2');
    await page.mouse.move(0,0);await page.locator('#toggle').focus();await page.waitForTimeout(5500);
    assert.equal(await badge.textContent(),'1/2');assert.equal(await page.locator('#mini-claude').textContent(),'85%');assert.deepEqual(await shape(),baseline);
    assert.equal(await app.evaluate(()=>global.carouselRefreshes),0,'Carousel must not request quota refreshes');
    const stale=structuredClone(fixture);stale.providers[id].status='stale';stale.providers[id].error='fixture offline';await send(stale);await claude.click();
    assert.equal(await page.locator('#mini-claude').textContent(),'更新失敗');assert.equal(await claude.locator('.mini-alert').isVisible(),true);assert.match(await claude.getAttribute('title'),/Claude 個人/);assert.match(await claude.getAttribute('title'),/fixture offline/);
    for(const locale of ['zh-TW','en','ja','ko']){const translated=structuredClone(fixture);translated.settings.locale=locale;await send(translated);assert.match(await claude.getAttribute('title'),/Claude 個人/);assert.deepEqual(await shape(),baseline);}
    const hidden=structuredClone(fixture);hidden.settings.visible[id]=false;await send(hidden);assert.equal(await badge.isVisible(),false);assert.equal(await claude.getAttribute('data-account'),'claude');
    const onlyExtra=structuredClone(fixture);onlyExtra.settings.visible.claude=false;await send(onlyExtra);assert.equal(await claude.isVisible(),true);assert.equal(await claude.getAttribute('data-account'),id);
    await send(fixture);await page.mouse.move(0,0);await page.locator('#toggle').focus();
    await claude.dragTo(page.locator('.compact-provider.codex'));
    const order=(await page.evaluate(()=>window.quota.getState())).settings.order;assert.ok(order.indexOf('claude')>order.indexOf('codex'),'Dragging still reorders provider slots');
    await send(fixture);await page.mouse.move(0,0);await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/compact-accounts.png'});
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,packaged:!!executablePath,checks:['distinct weekly quotas and progress fills','five-second rotation','hover pause and resume','manual switching','fixed compact geometry','localized account tooltip and reset time','per-account stale indicator','visibility changes','drag reorder preserved','no refresh IPC during rotation']},null,2));
  }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
