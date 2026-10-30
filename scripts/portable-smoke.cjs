const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const net=require('node:net');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const executable=process.env.QUOTA_PORTABLE_EXE;if(!executable)throw new Error('QUOTA_PORTABLE_EXE required');
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'quota-portable-'));
  const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const selected=server.address().port;server.close(()=>resolve(selected));});});
  const env={...process.env,QUOTA_TEST_DATA:directory};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(executable,['--demo','--test-mode','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`],{env,stdio:'ignore',windowsHide:true});
  let browser,page;
  try{
    const deadline=Date.now()+60000;let connected=false;
    while(Date.now()<deadline){try{const response=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(1000)});if(response.ok){connected=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
    assert.equal(connected,true,'Portable launcher must extract and start the actual app');
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];
    await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();
    const state=await page.evaluate(()=>window.quota.getState());assert.equal(state.version,'0.2.0');assert.equal(state.demo,true);
    await page.locator('#toggle').click();await page.locator('#panel').waitFor();
    assert.equal(await page.locator('.card').count(),3);assert.equal(await page.locator('.quota-row').count(),5);
    await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/portable-launch.png'});
    const report={passed:true,version:state.version,checks:['portable self-extraction and launch','test arguments forwarded','new UI loaded','demo-only isolated settings','three cards and reference quota windows','graceful quit through trusted IPC']};
    await page.evaluate(()=>window.quota.quit()).catch(error=>{if(!/closed/i.test(error.message))throw error;});
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(resolve,10000);child.once('exit',()=>{clearTimeout(timer);resolve();});});
    assert.equal(child.exitCode,0,'Portable wrapper must quit cleanly');
    await fs.writeFile('test-results/portable.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{
    if(page&&!page.isClosed())await page.evaluate(()=>window.quota.quit()).catch(()=>{});
    if(browser)await browser.close().catch(()=>{});
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(resolve,10000);child.once('exit',()=>{clearTimeout(timer);resolve();});});
    if(child.exitCode===null)child.kill();
    await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
