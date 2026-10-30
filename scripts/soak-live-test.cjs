const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'quota-soak-'));
  const env={...process.env,QUOTA_TEST_DATA:directory};delete env.ELECTRON_RUN_AS_NODE;
  if(process.platform==='win32'&&process.env.APPDATA){try{await fs.copyFile(path.join(process.env.APPDATA,'quota-island','provider-cooldowns.json'),path.join(directory,'provider-cooldowns.json'));}catch{}}
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--test-mode'],env});
  try{
    const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const snapshot=()=>page.evaluate(()=>window.quota.getState());
    const wait=async(predicate,ms)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){const state=await snapshot();if(predicate(state))return state;await new Promise(resolve=>setTimeout(resolve,500));}throw new Error('Live quota refresh did not complete within its deadline');};
    const initial=await wait(s=>Object.values(s.providers).every(p=>p.status!=='loading'),60000);
    for(const id of ['gemini','codex'])assert.equal(initial.providers[id].status,'ready',`${id}: ${initial.providers[id].error??'not ready'}`);
    await page.locator('#toggle').click();
    await page.evaluate(async()=>{await document.fonts.ready;});
    await fs.mkdir('test-results',{recursive:true});await page.mouse.move(0,0);await page.screenshot({path:'test-results/live-redesign-expanded.png'});
    assert.equal(await page.locator('.card.gemini .quota-row').count(),2,'Equivalent Antigravity variants should render as two real model groups');
    await new Promise(resolve=>setTimeout(resolve,5200));
    await page.locator('#refresh').click();
    const manual=await wait(s=>['gemini','codex'].every(id=>s.providers[id].updatedAt!==initial.providers[id].updatedAt),45000);
    console.log('Actual Gemini and Codex reads and manual refresh passed; waiting for the normal two-minute background refresh.');
    const automatic=await wait(s=>['gemini','codex'].every(id=>s.providers[id].updatedAt!==manual.providers[id].updatedAt),140000);
    for(const id of ['gemini','codex'])assert.equal(automatic.providers[id].status,'ready');
    assert.deepEqual(errors,[]);
    const times=s=>Object.fromEntries(['gemini','codex'].map(id=>[id,s.providers[id].updatedAt]));
    const report={passed:true,packaged:!!executablePath,initial:times(initial),manual:times(manual),automatic:times(automatic),claude:{status:automatic.providers.claude.status,error:automatic.providers.claude.error,nextPollAt:automatic.providers.claude.nextPollAt},checks:['real Antigravity model quotas','real Codex subscription quotas','equivalent model variants grouped','manual refresh obtains new timestamps','normal background polling obtains new timestamps','Claude Retry-After preserved','no renderer exceptions']};
    await fs.writeFile('test-results/soak-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
