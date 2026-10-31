const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-styles-')),env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;const executablePath=process.env.QUOTA_PACKAGED_EXE;
 const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});let app=await launch();
 try{let page=await app.firstWindow();await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();await page.emulateMedia({reducedMotion:'no-preference'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const hashes=()=>page.locator('#pet-stage .pet-sprite canvas').evaluateAll(nodes=>nodes.map(c=>{let n=0,alpha=0;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i++){n=(Math.imul(n,31)+d[i])|0;if(i%4===3)alpha+=d[i];}return {hash:n,alpha};}));
  await fs.mkdir('test-results',{recursive:true});
  for(const style of ['classic','smooth','pixel']){
   await page.evaluate(style=>window.quota.settings({petStyle:style,petAlerts:false,petIdle:false}),style);
   await page.evaluate(()=>window.QuotaPets.preview());await page.locator('#pet-stage').waitFor();await page.waitForFunction(()=>innerHeight===188);
   if(style!=='classic'){
    await page.waitForFunction(()=>[...document.querySelectorAll('#pet-stage .pet-sprite')].every(el=>el.dataset.frame!==undefined));
    const first=await hashes();assert.ok(first.every(f=>f.alpha>10000),`${style}: every actor has real visible pixels`);
    await page.waitForTimeout(650);assert.notDeepEqual(await hashes(),first,`${style}: actual drawing frames must advance`);
    assert.equal(await page.locator('#pet-stage .pet-sprite').evaluateAll(nodes=>nodes.every(el=>{const p=el.getBoundingClientRect(),b=document.querySelector(`.compact-provider[data-provider="${el.dataset.pet}"]`).getBoundingClientRect();return Math.abs(p.x+p.width/2-b.x-b.width/2)<.6;})),true);
   }
   await page.screenshot({path:`test-results/pet-style-${style}.png`});await page.locator('#pet-close').click();await page.waitForFunction(()=>innerHeight===76);
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.QuotaPets.preview());await page.locator('#pet-stage').waitFor();await page.waitForTimeout(150);const still=await hashes();await page.waitForTimeout(400);assert.deepEqual(await hashes(),still,'Reduced motion freezes sprite frames');await page.locator('#pet-close').click();
  await page.evaluate(()=>window.quota.settings({petStyle:'invalid'}));assert.equal((await page.evaluate(()=>window.quota.getState())).settings.petStyle,'pixel');
  await page.locator('#toggle').click();await page.locator('#settings-toggle').click();await page.locator('#pet-style').selectOption('smooth');assert.equal((await page.evaluate(()=>window.quota.getState())).settings.petStyle,'smooth');
  assert.deepEqual(errors,[]);await app.close();app=await launch();page=await app.firstWindow();assert.equal((await page.evaluate(()=>window.quota.getState())).settings.petStyle,'smooth','Choice persists across restart');
  console.log(JSON.stringify({passed:true,packaged:!!executablePath,checks:['three retained playable styles','real pixel-frame advancement','all actors visible and centered','reduced-motion freeze','settings selector and restart persistence','invalid style rejected','no renderer errors']},null,2));
 }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
